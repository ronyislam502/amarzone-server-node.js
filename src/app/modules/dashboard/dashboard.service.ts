import mongoose, { Types } from "mongoose";
import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { Product } from "../product/product.model";
import { Category } from "../category/category.model";
import { InventoryProduct } from "../inventory/inventory.model";
import { Payment } from "../payment/payment.model";
import { ServiceReview } from "../serviceReview/serviceReview.model";
import { ProductReview } from "../productReview/productReview.model";
import { AccountHealth } from "../health/health.model";
import { SlaViolation } from "../violation/violation.model";
import { Fraud } from "../fraud/fraud.model";
import { Dispute } from "../dispute/dispute.model";
import { Vendor } from "../vendor/vendor.model";
import { Customer } from "../customer/customer.model";
import { TDashboardQuery } from "./dashboard.interface";
import { ORDER_STATUS, PAYMENT_STATUS, USER_ROLE, USER_STATUS, SLA_SEVERITY } from "../../interface/common";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder";

// ─── HELPER: DATE FILTER CALCULATOR ──────────────────────────────────────────
const getDateFilter = (query: TDashboardQuery) => {
  const now = new Date();
  let startDate = new Date();

  if (query.range === "7_days") {
    startDate.setDate(now.getDate() - 7);
  } else if (query.range === "90_days") {
    startDate.setDate(now.getDate() - 90);
  } else if (query.range === "12_months") {
    startDate.setFullYear(now.getFullYear() - 1);
  } else if (query.range === "custom" && query.startDate && query.endDate) {
    return {
      $gte: new Date(query.startDate),
      $lte: new Date(query.endDate),
    };
  } else {
    startDate.setDate(now.getDate() - 30);
  }

  return { $gte: startDate, $lte: now };
};

// =============================================================================
// MARKETPLACE (SUPER ADMIN & ADMIN) MODULAR HELPERS
// =============================================================================

const getOverviewCards = async (dateFilter: Record<string, unknown>, todayStart: Date) => {
  const [orderStatsResult, todayOrders] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: dateFilter, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
            },
          },
          marketplaceCommission: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$commission", 0],
            },
          },
          totalOrders: { $sum: 1 },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.PENDING] }, 1, 0] },
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.UNSHIPPED] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.SHIPPED] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: {
              $cond: [
                { $in: ["$status", [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERED]] },
                1,
                0,
              ],
            },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.CANCELLED] }, 1, 0] },
          },
          refundedOrders: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", ORDER_STATUS.REFUNDED] },
                    { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Order.countDocuments({ createdAt: { $gte: todayStart }, isDeleted: { $ne: true } }),
  ]);

  const oStats = orderStatsResult[0] || {};
  const totalRevenue = oStats.totalRevenue || 0;
  const marketplaceCommission = oStats.marketplaceCommission || 0;

  return {
    totalRevenue,
    marketplaceCommission,
    vendorEarnings: totalRevenue - marketplaceCommission,
    totalOrders: oStats.totalOrders || 0,
    todayOrders,
    pendingOrders: oStats.pendingOrders || 0,
    processingOrders: oStats.processingOrders || 0,
    shippedOrders: oStats.shippedOrders || 0,
    deliveredOrders: oStats.deliveredOrders || 0,
    cancelledOrders: oStats.cancelledOrders || 0,
    refundedOrders: oStats.refundedOrders || 0,
  };
};

const getUsersStats = async (startOfMonth: Date) => {
  const result = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        totalCustomers: {
          $sum: { $cond: [{ $eq: ["$role", USER_ROLE.CUSTOMER] }, 1, 0] },
        },
        totalVendors: {
          $sum: { $cond: [{ $eq: ["$role", USER_ROLE.VENDOR] }, 1, 0] },
        },
        activeVendors: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$role", USER_ROLE.VENDOR] },
                  { $eq: ["$status", USER_STATUS.ACTIVE] },
                ],
              },
              1,
              0,
            ],
          },
        },
        suspendedVendors: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$role", USER_ROLE.VENDOR] },
                  { $eq: ["$status", USER_STATUS.SUSPENDED] },
                ],
              },
              1,
              0,
            ],
          },
        },
        blockedUsers: {
          $sum: { $cond: [{ $eq: ["$status", USER_STATUS.BLOCKED] }, 1, 0] },
        },
        newUsersThisMonth: {
          $sum: { $cond: [{ $gte: ["$createdAt", startOfMonth] }, 1, 0] },
        },
      },
    },
  ]);

  const uStats = result[0] || {};
  return {
    totalUsers: uStats.totalUsers || 0,
    totalCustomers: uStats.totalCustomers || 0,
    totalVendors: uStats.totalVendors || 0,
    activeVendors: uStats.activeVendors || 0,
    suspendedVendors: uStats.suspendedVendors || 0,
    blockedUsers: uStats.blockedUsers || 0,
    newUsersThisMonth: uStats.newUsersThisMonth || 0,
  };
};

const getInventoryStats = async () => {
  const result = await InventoryProduct.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    {
      $group: {
        _id: null,
        totalInventory: { $sum: "$seller.quantity" },
        lowStockProducts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$seller.quantity", 0] },
                  { $lte: ["$seller.quantity", 10] },
                ],
              },
              1,
              0,
            ],
          },
        },
        outOfStockInventory: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $lte: ["$seller.quantity", 0] },
                  { $eq: ["$seller.isStock", false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const iStats = result[0] || {};
  return {
    totalInventory: iStats.totalInventory || 0,
    lowStockProducts: iStats.lowStockProducts || 0,
    outOfStockInventory: iStats.outOfStockInventory || 0,
  };
};

const getProductsStats = async () => {
  const [productFacet, categoriesCount, inventoryStats] = await Promise.all([
    Product.aggregate([
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalProducts: { $sum: 1 },
                activeProducts: {
                  $sum: { $cond: [{ $ne: ["$isDeleted", true] }, 1, 0] },
                },
                inactiveProducts: {
                  $sum: { $cond: [{ $eq: ["$isDeleted", true] }, 1, 0] },
                },
                bestSellerProducts: {
                  $sum: { $cond: [{ $eq: ["$isBestSeller", true] }, 1, 0] },
                },
              },
            },
          ],
          brands: [{ $group: { _id: "$brand" } }, { $count: "count" }],
        },
      },
    ]),
    Category.countDocuments({ isDeleted: { $ne: true } }),
    getInventoryStats(),
  ]);

  const pTotals = productFacet[0]?.totals[0] || {};
  const brandsCount = productFacet[0]?.brands[0]?.count || 0;

  return {
    totalProducts: pTotals.totalProducts || 0,
    activeProducts: pTotals.activeProducts || 0,
    inactiveProducts: pTotals.inactiveProducts || 0,
    outOfStockProducts: inventoryStats.outOfStockInventory,
    bestSellerProducts: pTotals.bestSellerProducts || 0,
    categoriesCount,
    brandsCount,
  };
};

const getPaymentStats = async (dateFilter: Record<string, unknown>) => {
  const result = await Payment.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: null,
        totalSuccessfulPayments: {
          $sum: { $cond: [{ $eq: ["$status", PAYMENT_STATUS.PAID] }, 1, 0] },
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ["$status", PAYMENT_STATUS.UNPAID] }, 1, 0] },
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ["$status", PAYMENT_STATUS.UNPAID] }, 1, 0] },
        },
        refundedPayments: {
          $sum: { $cond: [{ $eq: ["$status", PAYMENT_STATUS.REFUNDED] }, 1, 0] },
        },
      },
    },
  ]);

  const payStats = result[0] || {};
  return {
    totalSuccessfulPayments: payStats.totalSuccessfulPayments || 0,
    pendingPayments: payStats.pendingPayments || 0,
    failedPayments: payStats.failedPayments || 0,
    refundedPayments: payStats.refundedPayments || 0,
  };
};

const getOrderAnalytics = async (thirtyDaysAgo: Date) => {
  const [monthlyAnalytics, dailyAnalytics] = await Promise.all([
    Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    monthlyAnalytics,
    dailyAnalytics,
    ordersPerMonth: monthlyAnalytics.map((item: any) => ({
      year: item._id.year,
      month: item._id.month,
      count: item.count,
    })),
    revenuePerMonth: monthlyAnalytics.map((item: any) => ({
      year: item._id.year,
      month: item._id.month,
      revenue: item.revenue,
    })),
    ordersPerDay: dailyAnalytics.map((item: any) => ({
      date: item._id,
      count: item.count,
    })),
    revenuePerDay: dailyAnalytics.map((item: any) => ({
      date: item._id,
      revenue: item.revenue,
    })),
  };
};

const getTopLists = async () => {
  const [topSellingProducts, topSellingCategories, topVendors, topCustomers] = await Promise.all([
    Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalSold: { $sum: "$products.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 1,
          totalSold: 1,
          title: "$productDetails.title",
          thumbnail: "$productDetails.thumbnail",
          asin: "$productDetails.asin",
        },
      },
    ]),
    Order.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$productInfo.category",
          totalQuantity: { $sum: "$products.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $project: {
          _id: 1,
          categoryName: "$categoryDetails.name",
          totalQuantity: 1,
        },
      },
    ]),
    Order.aggregate([
      { $match: { isDeleted: { $ne: true }, paymentStatus: PAYMENT_STATUS.PAID } },
      {
        $group: {
          _id: "$vendor",
          totalRevenue: { $sum: "$totalPrice" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          _id: 1,
          totalRevenue: 1,
          totalOrders: 1,
          name: "$userInfo.name",
          email: "$userInfo.email",
        },
      },
    ]),
    Order.aggregate([
      { $match: { isDeleted: { $ne: true }, paymentStatus: PAYMENT_STATUS.PAID } },
      {
        $group: {
          _id: "$customer",
          totalSpent: { $sum: "$totalPrice" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          _id: 1,
          totalSpent: 1,
          totalOrders: 1,
          name: "$userInfo.name",
          email: "$userInfo.email",
        },
      },
    ]),
  ]);

  return {
    topSellingProducts,
    topSellingCategories,
    topVendors,
    topCustomers,
  };
};

const getReviewStats = async () => {
  const [serviceRatings, productRatings] = await Promise.all([
    ServiceReview.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]),
    ProductReview.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRatingSum = 0;
  let totalReviewCount = 0;

  for (const r of [...serviceRatings, ...productRatings]) {
    const star = r._id;
    if (star >= 1 && star <= 5) {
      ratingDistribution[star] = (ratingDistribution[star] || 0) + r.count;
      totalRatingSum += star * r.count;
      totalReviewCount += r.count;
    }
  }

  const averageRating = totalReviewCount > 0 ? +(totalRatingSum / totalReviewCount).toFixed(2) : 5.0;

  return {
    totalReviews: totalReviewCount,
    averageRating,
    ratingDistribution,
  };
};

const getMarketplaceHealth = async () => {
  const [activeSlaViolations, suspendedVendors, fraudAlerts, openDisputes, pendingRefunds] = await Promise.all([
    SlaViolation.countDocuments({ isResolved: false }),
    User.countDocuments({ role: USER_ROLE.VENDOR, status: USER_STATUS.SUSPENDED }),
    Fraud.countDocuments({ isResolved: false }),
    Dispute.countDocuments({ status: { $in: ["OPEN", "UNDER_REVIEW"] } }),
    Order.countDocuments({ status: ORDER_STATUS.REFUNDED }),
  ]);

  return {
    activeSlaViolations,
    suspendedVendors,
    fraudAlerts,
    openDisputes,
    pendingRefunds,
  };
};

const getRecentActivities = async (query: TDashboardQuery) => {
  const [recentOrders, recentRefunds, recentDisputes, recentVendors, recentCustomers] = await Promise.all([
    new QueryBuilder(
      Order.find({ isDeleted: { $ne: true } })
        .populate("customer", "name email")
        .populate("vendor", "name email"),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Order.find({ status: ORDER_STATUS.REFUNDED, isDeleted: { $ne: true } }).populate(
        "customer",
        "name email"
      ),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Dispute.find()
        .populate("customer", "name email")
        .populate("vendor", "name email"),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Vendor.find({ isDeleted: { $ne: true } }).populate("user", "name email status"),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Customer.find({ isDeleted: { $ne: true } }).populate("user", "name email status"),
      query
    )
      .sort()
      .paginate().modelQuery,
  ]);

  return {
    recentOrders,
    recentRefunds,
    recentDisputes,
    recentVendors,
    recentCustomers,
  };
};

// ─── SUPER ADMIN DASHBOARD SERVICE ───────────────────────────────────────────
const getSuperAdminDashboardFromDB = async (query: TDashboardQuery) => {
  const dateFilter = getDateFilter(query);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    overviewCards,
    users,
    products,
    inventory,
    payments,
    orderAnalytics,
    topLists,
    reviews,
    marketplaceHealth,
    recentActivities,
  ] = await Promise.all([
    getOverviewCards(dateFilter, todayStart),
    getUsersStats(startOfMonth),
    getProductsStats(),
    getInventoryStats(),
    getPaymentStats(dateFilter),
    getOrderAnalytics(thirtyDaysAgo),
    getTopLists(),
    getReviewStats(),
    getMarketplaceHealth(),
    getRecentActivities(query),
  ]);

  const charts = {
    revenueChart: orderAnalytics.dailyAnalytics.map((item: any) => ({
      label: item._id,
      value: item.revenue,
    })),
    ordersChart: orderAnalytics.dailyAnalytics.map((item: any) => ({
      label: item._id,
      value: item.count,
    })),
    userGrowthChart: orderAnalytics.monthlyAnalytics.map((item: any) => ({
      label: `${item._id.year}-${item._id.month}`,
      value: item.count,
    })),
    categorySalesChart: topLists.topSellingCategories.map((item: any) => ({
      category: item.categoryName,
      sales: item.totalQuantity,
    })),
    paymentStatusPieChart: [
      { status: "PAID", count: payments.totalSuccessfulPayments },
      { status: "UNPAID", count: payments.failedPayments },
      { status: "REFUNDED", count: payments.refundedPayments },
    ],
    orderStatusPieChart: [
      { status: "PENDING", count: overviewCards.pendingOrders },
      { status: "UNSHIPPED", count: overviewCards.processingOrders },
      { status: "SHIPPED", count: overviewCards.shippedOrders },
      { status: "DELIVERED", count: overviewCards.deliveredOrders },
      { status: "CANCELLED", count: overviewCards.cancelledOrders },
      { status: "REFUNDED", count: overviewCards.refundedOrders },
    ],
  };

  const { monthlyAnalytics, dailyAnalytics, ...ordersAnalytics } = orderAnalytics;

  return {
    overviewCards,
    users,
    products,
    inventory,
    payments,
    ordersAnalytics,
    topLists,
    reviews,
    marketplaceHealth,
    recentActivities,
    charts,
  };
};

// ─── ADMIN DASHBOARD SERVICE ─────────────────────────────────────────────────
const getAdminDashboardFromDB = async (query: TDashboardQuery) => {
  const superAdminData = await getSuperAdminDashboardFromDB(query);

  const { marketplaceCommission, vendorEarnings, ...adminOverviewCards } = superAdminData.overviewCards;
  const { revenueChart, ...adminCharts } = superAdminData.charts;

  return {
    ...superAdminData,
    overviewCards: adminOverviewCards,
    charts: adminCharts,
  };
};

// =============================================================================
// VENDOR MODULAR SERVICES
// =============================================================================

const getVendorOverview = async (vendorObjId: Types.ObjectId) => {
  const result = await Order.aggregate([
    {
      $match: {
        vendor: vendorObjId,
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
          },
        },
        pendingBalance: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
                  { $in: ["$status", [ORDER_STATUS.PENDING, ORDER_STATUS.UNSHIPPED, ORDER_STATUS.SHIPPED]] },
                ],
              },
              "$totalPrice",
              0,
            ],
          },
        },
        withdrawableBalance: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
                  { $in: ["$status", [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERED]] },
                ],
              },
              "$totalPrice",
              0,
            ],
          },
        },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  const overview = result[0] || {};
  return {
    totalRevenue: overview.totalRevenue || 0,
    pendingBalance: overview.pendingBalance || 0,
    withdrawableBalance: overview.withdrawableBalance || 0,
    totalOrders: overview.totalOrders || 0,
  };
};

const getVendorSales = async (vendorObjId: Types.ObjectId, todayStart: Date, startOfMonth: Date) => {
  const result = await Order.aggregate([
    {
      $match: {
        vendor: vendorObjId,
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        revenueThisMonth: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$createdAt", startOfMonth] },
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
                ],
              },
              "$totalPrice",
              0,
            ],
          },
        },
        revenueToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$createdAt", todayStart] },
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] },
                ],
              },
              "$totalPrice",
              0,
            ],
          },
        },
        ordersToday: {
          $sum: { $cond: [{ $gte: ["$createdAt", todayStart] }, 1, 0] },
        },
        ordersThisMonth: {
          $sum: { $cond: [{ $gte: ["$createdAt", startOfMonth] }, 1, 0] },
        },
      },
    },
  ]);

  const sales = result[0] || {};
  return {
    revenueThisMonth: sales.revenueThisMonth || 0,
    revenueToday: sales.revenueToday || 0,
    ordersToday: sales.ordersToday || 0,
    ordersThisMonth: sales.ordersThisMonth || 0,
  };
};

const getVendorProductsStats = async (vendorObjId: Types.ObjectId) => {
  const productLists = await InventoryProduct.aggregate([
    { $match: { "seller.vendor": vendorObjId, isDeleted: { $ne: true } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              activeListings: {
                $sum: { $cond: [{ $eq: ["$seller.isStock", true] }, 1, 0] },
              },
              draftListings: {
                $sum: { $cond: [{ $eq: ["$seller.isStock", false] }, 1, 0] },
              },
              outOfStockProducts: {
                $sum: { $cond: [{ $lte: ["$seller.quantity", 0] }, 1, 0] },
              },
            },
          },
        ],
        lowStockList: [
          { $match: { "seller.quantity": { $gt: 0, $lte: 10 } } },
          { $limit: 5 },
        ],
        outOfStockList: [
          { $match: { "seller.quantity": { $lte: 0 } } },
          { $limit: 5 },
        ],
        buyBoxWinnerList: [
          { $match: { "seller.isBuyBoxWinner": true } },
          { $limit: 5 },
        ],
      },
    },
  ]);

  const pTotals = productLists[0]?.totals[0] || {};
  return {
    activeListings: pTotals.activeListings || 0,
    draftListings: pTotals.draftListings || 0,
    outOfStockProductsCount: pTotals.outOfStockProducts || 0,
    lowStockProducts: productLists[0]?.lowStockList || [],
    outOfStockProducts: productLists[0]?.outOfStockList || [],
    buyBoxWinners: productLists[0]?.buyBoxWinnerList || [],
  };
};

const getVendorPerformance = async (vendorObjId: Types.ObjectId) => {
  const [healthDoc, serviceReviews] = await Promise.all([
    AccountHealth.findOne({ vendor: vendorObjId }).lean(),
    ServiceReview.aggregate([
      { $match: { vendor: vendorObjId, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
        },
      },
    ]),
  ]);

  const avgRating = serviceReviews[0]?.avgRating ? +serviceReviews[0].avgRating.toFixed(2) : 5.0;

  return {
    orderDefectRate: healthDoc?.orderDefectRate || 0,
    lateShipmentRate: healthDoc?.lateShipmentRate || 0,
    cancellationRate: healthDoc?.cancellationRate || 0,
    validTrackingRate: healthDoc?.validTrackingRate || 100,
    averageRating: avgRating,
    accountHealthScore: healthDoc?.score || 1000,
    healthStatus: healthDoc?.status || "HEALTHY",
  };
};

const getVendorSlaStats = async (vendorObjId: Types.ObjectId) => {
  const result = await SlaViolation.aggregate([
    { $match: { vendor: vendorObjId } },
    {
      $group: {
        _id: null,
        activeViolations: {
          $sum: { $cond: [{ $eq: ["$isResolved", false] }, 1, 0] },
        },
        warningCount: {
          $sum: { $cond: [{ $eq: ["$severity", SLA_SEVERITY.WARNING] }, 1, 0] },
        },
        suspensionCount: {
          $sum: { $cond: [{ $eq: ["$severity", SLA_SEVERITY.SUSPENSION] }, 1, 0] },
        },
      },
    },
  ]);

  const sla = result[0] || {};
  return {
    activeViolations: sla.activeViolations || 0,
    warningCount: sla.warningCount || 0,
    suspensionCount: sla.suspensionCount || 0,
  };
};

const getVendorCustomerStats = async (vendorObjId: Types.ObjectId) => {
  const result = await Order.aggregate([
    { $match: { vendor: vendorObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: "$customer",
        orderCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        returningCustomers: {
          $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] },
        },
        newCustomers: {
          $sum: { $cond: [{ $eq: ["$orderCount", 1] }, 1, 0] },
        },
      },
    },
  ]);

  const cust = result[0] || {};
  return {
    totalCustomers: cust.totalCustomers || 0,
    returningCustomers: cust.returningCustomers || 0,
    newCustomers: cust.newCustomers || 0,
  };
};

const getVendorRefundStats = async (vendorObjId: Types.ObjectId) => {
  const result = await Order.aggregate([
    { $match: { vendor: vendorObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: null,
        pendingRefunds: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", ORDER_STATUS.CANCELLED] },
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.UNPAID] },
                ],
              },
              1,
              0,
            ],
          },
        },
        completedRefunds: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", ORDER_STATUS.REFUNDED] },
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const ref = result[0] || {};
  return {
    pendingRefunds: ref.pendingRefunds || 0,
    completedRefunds: ref.completedRefunds || 0,
  };
};

const getVendorDisputeStats = async (vendorObjId: Types.ObjectId) => {
  const result = await Dispute.aggregate([
    { $match: { vendor: vendorObjId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const dispMap: Record<string, number> = {};
  for (const d of result) {
    dispMap[d._id] = d.count;
  }

  return {
    open: dispMap["OPEN"] || 0,
    underReview: dispMap["UNDER_REVIEW"] || 0,
    resolved: dispMap["RESOLVED"] || 0,
  };
};

const getVendorMonthlyAnalytics = async (vendorObjId: Types.ObjectId) => {
  return await Order.aggregate([
    { $match: { vendor: vendorObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        ordersCount: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
};

const getVendorRecentActivities = async (vendorObjId: Types.ObjectId, query: TDashboardQuery) => {
  const [recentOrders, recentReviews, recentRefunds, recentDisputes] = await Promise.all([
    new QueryBuilder(
      Order.find({ vendor: vendorObjId, isDeleted: { $ne: true } }).populate(
        "customer",
        "name email"
      ),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      ServiceReview.find({ vendor: vendorObjId, isDeleted: { $ne: true } }).populate(
        "customer",
        "name email"
      ),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Order.find({
        vendor: vendorObjId,
        status: ORDER_STATUS.REFUNDED,
        isDeleted: { $ne: true },
      }).populate("customer", "name email"),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Dispute.find({ vendor: vendorObjId }).populate("customer", "name email"),
      query
    )
      .sort()
      .paginate().modelQuery,
  ]);

  return {
    recentOrders,
    recentReviews,
    recentRefunds,
    recentDisputes,
  };
};

// ─── VENDOR DASHBOARD SERVICE ────────────────────────────────────────────────
const getVendorDashboardFromDB = async (
  vendorId: string,
  query: TDashboardQuery
) => {
  const vendorObjId = new Types.ObjectId(vendorId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    overviewStats,
    sales,
    productsStats,
    performance,
    sla,
    customers,
    refund,
    disputes,
    monthlyAnalytics,
    recent,
  ] = await Promise.all([
    getVendorOverview(vendorObjId),
    getVendorSales(vendorObjId, todayStart, startOfMonth),
    getVendorProductsStats(vendorObjId),
    getVendorPerformance(vendorObjId),
    getVendorSlaStats(vendorObjId),
    getVendorCustomerStats(vendorObjId),
    getVendorRefundStats(vendorObjId),
    getVendorDisputeStats(vendorObjId),
    getVendorMonthlyAnalytics(vendorObjId),
    getVendorRecentActivities(vendorObjId, query),
  ]);

  const overview = {
    ...overviewStats,
    activeListings: productsStats.activeListings,
    draftListings: productsStats.draftListings,
    outOfStockProducts: productsStats.outOfStockProductsCount,
  };

  const products = {
    bestSellingProducts: [],
    lowStockProducts: productsStats.lowStockProducts,
    outOfStockProducts: productsStats.outOfStockProducts,
    buyBoxWinners: productsStats.buyBoxWinners,
  };

  const charts = {
    monthlyRevenue: monthlyAnalytics.map((item: any) => ({
      label: `${item._id.year}-${item._id.month}`,
      value: item.revenue,
    })),
    monthlyOrders: monthlyAnalytics.map((item: any) => ({
      label: `${item._id.year}-${item._id.month}`,
      value: item.ordersCount,
    })),
    productSales: [],
    ratingTrend: [],
  };

  return {
    overview,
    sales,
    products,
    performance,
    sla,
    customers,
    refund,
    disputes,
    charts,
    recent,
  };
};

// =============================================================================
// CUSTOMER MODULAR SERVICES
// =============================================================================

const getCustomerOverview = async (customerObjId: Types.ObjectId) => {
  const result = await Order.aggregate([
    { $match: { customer: customerObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        pendingOrders: {
          $sum: {
            $cond: [
              { $in: ["$status", [ORDER_STATUS.PENDING, ORDER_STATUS.UNSHIPPED]] },
              1,
              0,
            ],
          },
        },
        deliveredOrders: {
          $sum: {
            $cond: [
              { $in: ["$status", [ORDER_STATUS.DELIVERED, ORDER_STATUS.DELIVERED]] },
              1,
              0,
            ],
          },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.CANCELLED] }, 1, 0] },
        },
        returnedOrders: {
          $sum: { $cond: [{ $eq: ["$status", ORDER_STATUS.REFUNDED] }, 1, 0] },
        },
      },
    },
  ]);

  const oStats = result[0] || {};
  return {
    totalOrders: oStats.totalOrders || 0,
    pendingOrders: oStats.pendingOrders || 0,
    deliveredOrders: oStats.deliveredOrders || 0,
    cancelledOrders: oStats.cancelledOrders || 0,
    returnedOrders: oStats.returnedOrders || 0,
    wishlistCount: 0,
    cartItems: 0,
  };
};

const getCustomerPayments = async (customerObjId: Types.ObjectId) => {
  const result = await Order.aggregate([
    { $match: { customer: customerObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: null,
        totalSpent: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
          },
        },
        pendingRefunds: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", ORDER_STATUS.CANCELLED] },
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.UNPAID] },
                ],
              },
              1,
              0,
            ],
          },
        },
        completedRefunds: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", ORDER_STATUS.REFUNDED] },
                  { $eq: ["$paymentStatus", PAYMENT_STATUS.REFUNDED] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const pStats = result[0] || {};
  return {
    totalSpent: pStats.totalSpent || 0,
    pendingRefunds: pStats.pendingRefunds || 0,
    completedRefunds: pStats.completedRefunds || 0,
  };
};

const getCustomerReviews = async (customerObjId: Types.ObjectId) => {
  const [sReviews, pReviews] = await Promise.all([
    ServiceReview.aggregate([
      { $match: { customer: customerObjId, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          sumRating: { $sum: "$rating" },
        },
      },
    ]),
    ProductReview.aggregate([
      { $match: { customer: customerObjId, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          sumRating: { $sum: "$rating" },
        },
      },
    ]),
  ]);

  const sCount = sReviews[0]?.count || 0;
  const sSum = sReviews[0]?.sumRating || 0;

  const pCount = pReviews[0]?.count || 0;
  const pSum = pReviews[0]?.sumRating || 0;

  const totalReviewsWritten = sCount + pCount;
  const totalRatingSum = sSum + pSum;
  const avgRatingGiven = totalReviewsWritten > 0 ? +(totalRatingSum / totalReviewsWritten).toFixed(2) : 5.0;

  return {
    reviewsWritten: totalReviewsWritten,
    averageRatingGiven: avgRatingGiven,
  };
};

const getCustomerDisputes = async (customerObjId: Types.ObjectId) => {
  const result = await Dispute.aggregate([
    { $match: { customer: customerObjId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const dispMap: Record<string, number> = {};
  for (const d of result) {
    dispMap[d._id] = d.count;
  }

  return {
    open: dispMap["OPEN"] || 0,
    underReview: dispMap["UNDER_REVIEW"] || 0,
    resolved: dispMap["RESOLVED"] || 0,
  };
};

const getCustomerMonthlySpending = async (customerObjId: Types.ObjectId) => {
  return await Order.aggregate([
    { $match: { customer: customerObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        totalAmount: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", PAYMENT_STATUS.PAID] }, "$totalPrice", 0],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
};

const getCustomerOrderStatusDistribution = async (customerObjId: Types.ObjectId) => {
  return await Order.aggregate([
    { $match: { customer: customerObjId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
};

const getCustomerRecentActivities = async (customerObjId: Types.ObjectId, query: TDashboardQuery) => {
  const [recentOrders, recentReviews, recentRefunds] = await Promise.all([
    new QueryBuilder(
      Order.find({ customer: customerObjId, isDeleted: { $ne: true } }).populate(
        "vendor",
        "name email"
      ),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      ServiceReview.find({ customer: customerObjId, isDeleted: { $ne: true } }).populate(
        "vendor",
        "name email"
      ),
      query
    )
      .sort()
      .paginate().modelQuery,
    new QueryBuilder(
      Order.find({
        customer: customerObjId,
        status: ORDER_STATUS.REFUNDED,
        isDeleted: { $ne: true },
      }).populate("vendor", "name email"),
      query
    )
      .sort()
      .paginate().modelQuery,
  ]);

  return {
    recentOrders,
    recentReviews,
    recentRefunds,
  };
};

// ─── CUSTOMER DASHBOARD SERVICE ──────────────────────────────────────────────
const getCustomerDashboardFromDB = async (
  customerObjId: Types.ObjectId,
  query: TDashboardQuery
) => {
  const [
    overview,
    payments,
    reviews,
    disputes,
    monthlySpending,
    orderStatusDist,
    recent,
  ] = await Promise.all([
    getCustomerOverview(customerObjId),
    getCustomerPayments(customerObjId),
    getCustomerReviews(customerObjId),
    getCustomerDisputes(customerObjId),
    getCustomerMonthlySpending(customerObjId),
    getCustomerOrderStatusDistribution(customerObjId),
    getCustomerRecentActivities(customerObjId, query),
  ]);

  const charts = {
    monthlySpending: monthlySpending.map((item: any) => ({
      label: `${item._id.year}-${item._id.month}`,
      amount: item.totalAmount,
    })),
    orderStatusDistribution: orderStatusDist.map((item: any) => ({
      status: item._id,
      count: item.count,
    })),
  };

  return {
    overview,
    payments,
    reviews,
    disputes,
    charts,
    recent,
  };
};

// =============================================================================
// CENTRALIZED ROLE-BASED DISPATCHER SERVICE
// =============================================================================

const statisticsDashboardDataFromDB = async (
  user: JwtPayload,
  query: TDashboardQuery
) => {
  // 1. Verify user exists in database by email (ONLY ONCE)
  const isUserExists = await User.isUserExistsByEmail(user.email);
  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // 2. Dispatch using the verified database user to determine role
  switch (isUserExists.role) {
    case USER_ROLE.SUPER_ADMIN:
      return getSuperAdminDashboardFromDB(query);

    case USER_ROLE.ADMIN:
      return getAdminDashboardFromDB(query);

    case USER_ROLE.VENDOR:
      return getVendorDashboardFromDB(String(isUserExists._id), query);

    case USER_ROLE.CUSTOMER:
      return getCustomerDashboardFromDB(isUserExists._id as Types.ObjectId, query);

    default:
      throw new AppError(httpStatus.FORBIDDEN, "Unauthorized access.");
  }
};

export const DashboardServices = {
  statisticsDashboardDataFromDB,
};
