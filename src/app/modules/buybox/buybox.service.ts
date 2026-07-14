import mongoose from "mongoose";
import { Order } from "../order/order.model";
import { AccountHealth } from "../health/health.model";
import { ServiceReview } from "../review/review.model";
import { InventoryProduct } from "../inventory/inventory.model";
import { BUY_BOX_CONFIG } from "./buybox.config";

const calculateBuyBox = async (vendorId: string, session?: mongoose.ClientSession) => {
  const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

  // 1. Get total completed sales/orders
  const completedOrdersCount = await Order.countDocuments({
    vendor: vendorObjectId,
    status: { $in: ["COMPLETE", "DELIVERED"] },
  }).session(session || null);

  // 2. Fetch Account Health
  const health = await AccountHealth.findOne({
    vendor: vendorObjectId,
  }).session(session || null);

  // If no health record, they are not eligible (new vendor)
  if (!health) {
    await disableAllBuyBoxForVendor(vendorId, session);
    return { eligible: false, message: "No account health record found." };
  }

  // 3. Get Average Service Review Rating
  const reviewStats = await ServiceReview.aggregate([
    {
      $match: {
        vendor: vendorObjectId,
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$vendor",
        averageRating: { $avg: "$rating" },
      },
    },
  ]).session(session || null);

  const averageServiceReviewRating =
    reviewStats.length > 0 ? reviewStats[0].averageRating : 5.0;

  // 4. Verify Minimum Sales Requirement
  if (completedOrdersCount < BUY_BOX_CONFIG.minCompletedOrders) {
    await disableAllBuyBoxForVendor(vendorId, session);
    return {
      eligible: false,
      message: `Minimum sales requirement not met. Completed orders: ${completedOrdersCount}/${BUY_BOX_CONFIG.minCompletedOrders}`,
    };
  }

  // 5. Evaluate Buy Box Eligibility thresholds
  const isEligible =
    health.score >= BUY_BOX_CONFIG.minAccountHealthScore &&
    health.orderDefectRate <= BUY_BOX_CONFIG.maxOrderDefectRate &&
    health.lateShipmentRate <= BUY_BOX_CONFIG.maxLateShipmentRate &&
    health.cancellationRate <= BUY_BOX_CONFIG.maxCancellationRate &&
    health.validTrackingRate >= BUY_BOX_CONFIG.minValidTrackingRate &&
    averageServiceReviewRating >= BUY_BOX_CONFIG.minServiceReviewRating;

  if (!isEligible) {
    await disableAllBuyBoxForVendor(vendorId, session);
    return {
      eligible: false,
      message: "Vendor did not meet performance SLA thresholds.",
      metrics: {
        score: health.score,
        orderDefectRate: health.orderDefectRate,
        lateShipmentRate: health.lateShipmentRate,
        cancellationRate: health.cancellationRate,
        validTrackingRate: health.validTrackingRate,
        averageServiceReviewRating,
      },
    };
  }

  // 6. Vendor is eligible - perform Random Buy Box Assignment
  const inventoryProducts = await InventoryProduct.find({
    "seller.vendor": vendorObjectId,
    isDeleted: { $ne: true },
  }).session(session || null);

  const totalProducts = inventoryProducts.length;
  if (totalProducts === 0) {
    return { eligible: true, message: "Vendor is eligible but has no inventory products." };
  }

  const targetWinnerCount = Math.round(
    totalProducts * (BUY_BOX_CONFIG.assignmentPercentage / 100)
  );

  // Shuffle inventory products to randomly select winners
  const shuffled = [...inventoryProducts].sort(() => 0.5 - Math.random());
  const winnerIds = shuffled.slice(0, targetWinnerCount).map((p) => p._id);
  const loserIds = shuffled.slice(targetWinnerCount).map((p) => p._id);

  if (winnerIds.length > 0) {
    await InventoryProduct.updateMany(
      { _id: { $in: winnerIds } },
      { $set: { "seller.isBuyBoxWinner": true } }
    ).session(session || null);
  }

  if (loserIds.length > 0) {
    await InventoryProduct.updateMany(
      { _id: { $in: loserIds } },
      { $set: { "seller.isBuyBoxWinner": false } }
    ).session(session || null);
  }

  return {
    eligible: true,
    message: "Buy Box assigned successfully.",
    assignedCount: winnerIds.length,
  };
};

const disableAllBuyBoxForVendor = async (
  vendorId: string,
  session?: mongoose.ClientSession
) => {
  await InventoryProduct.updateMany(
    {
      "seller.vendor": new mongoose.Types.ObjectId(vendorId),
      isDeleted: { $ne: true },
    },
    { $set: { "seller.isBuyBoxWinner": false } }
  ).session(session || null);
};

export const BuyBoxServices = {
  calculateBuyBox,
  disableAllBuyBoxForVendor,
};
