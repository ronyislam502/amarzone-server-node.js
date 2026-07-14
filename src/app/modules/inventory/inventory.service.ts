import mongoose from "mongoose";
import { JwtPayload } from "jsonwebtoken";

import { User } from "../user/user.model";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { TInventoryProduct } from "./inventory.interface";
import { USER_ROLE } from "../../interface/common";
import { InventoryProduct } from "./inventory.model";
import { Product } from "../product/product.model";
import QueryBuilder from "../../builder/queryBuilder";
import { Order } from "../order/order.model";
import { AccountHealth } from "../health/health.model";
import { ServiceReview } from "../review/review.model";
import {
    emitBuyBoxUpdated,
    emitPriceUpdated,
    emitInventoryUpdated,
} from "../../socket/socketBuyBox";

// ─── Buy Box Configuration ───────────────────────────────────────────────────
const BUY_BOX_CONFIG = {
    minCompletedOrders: Number(process.env.BUY_BOX_MIN_COMPLETED_ORDERS) || 20,
    minAccountHealthScore: Number(process.env.BUY_BOX_MIN_ACCOUNT_HEALTH_SCORE) || 850,
    maxOrderDefectRate: Number(process.env.BUY_BOX_MAX_ORDER_DEFECT_RATE) || 1.0,
    maxCancellationRate: Number(process.env.BUY_BOX_MAX_CANCELLATION_RATE) || 2.5,
    maxLateShipmentRate: Number(process.env.BUY_BOX_MAX_LATE_SHIPMENT_RATE) || 4.0,
    minValidTrackingRate: Number(process.env.BUY_BOX_MIN_VALID_TRACKING_RATE) || 95.0,
    minServiceReviewRating: Number(process.env.BUY_BOX_MIN_SERVICE_REVIEW_RATING) || 4.5,
    assignmentPercentage: Number(process.env.BUY_BOX_ASSIGNMENT_PERCENTAGE) || 25,
};

// ─── Buy Box: Disable all inventory products for a vendor ────────────────────
const disableAllBuyBoxForVendor = async (
    vendorId: string,
    session?: mongoose.ClientSession
) => {
    const products = await InventoryProduct.find({
        "seller.vendor": new mongoose.Types.ObjectId(vendorId),
        isDeleted: { $ne: true },
    }).session(session || null);

    await InventoryProduct.updateMany(
        {
            "seller.vendor": new mongoose.Types.ObjectId(vendorId),
            isDeleted: { $ne: true },
        },
        { $set: { "seller.isBuyBoxWinner": false } }
    ).session(session || null);

    for (const prod of products) {
        emitBuyBoxUpdated(prod.product.toString(), {
            sellerId: vendorId,
            isBuyBoxWinner: false,
        });
    }
};

// ─── Buy Box: Core calculation ───────────────────────────────────────────────
const calculateBuyBox = async (
    vendorId: string,
    session?: mongoose.ClientSession
) => {
    const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

    // 1. Count completed/delivered orders
    const completedOrdersCount = await Order.countDocuments({
        vendor: vendorObjectId,
        status: { $in: ["COMPLETE", "DELIVERED"] },
    }).session(session || null);

    // 2. Fetch Account Health record
    const health = await AccountHealth.findOne({
        vendor: vendorObjectId,
    }).session(session || null);

    if (!health) {
        await disableAllBuyBoxForVendor(vendorId, session);
        return { eligible: false, message: "No account health record found." };
    }

    // 3. Get average Service Review rating (service reviews only, never product reviews)
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

    // 4. Minimum sales requirement
    if (completedOrdersCount < BUY_BOX_CONFIG.minCompletedOrders) {
        await disableAllBuyBoxForVendor(vendorId, session);
        return {
            eligible: false,
            message: `Minimum sales requirement not met. Completed: ${completedOrdersCount}/${BUY_BOX_CONFIG.minCompletedOrders}`,
        };
    }

    // 5. Evaluate performance SLA thresholds
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
            message: "Vendor did not meet performance thresholds.",
        };
    }

    // 6. Randomly assign Buy Box to a configured percentage of in-stock inventory
    const allProducts = await InventoryProduct.find({
        "seller.vendor": vendorObjectId,
        isDeleted: { $ne: true },
    }).session(session || null);

    if (allProducts.length === 0) {
        return { eligible: true, message: "Vendor is eligible but has no inventory." };
    }

    const instockProducts = allProducts.filter(
        (p) => p.seller.isStock === true && p.seller.quantity > 0
    );

    const targetWinnerCount = Math.round(
        instockProducts.length * (BUY_BOX_CONFIG.assignmentPercentage / 100)
    );

    const shuffled = [...instockProducts].sort(() => 0.5 - Math.random());
    const winnerIds = shuffled.slice(0, targetWinnerCount).map((p) => p._id);
    const loserIds = allProducts
        .filter((p) => !winnerIds.some((wid) => wid.equals(p._id)))
        .map((p) => p._id);

    if (winnerIds.length > 0) {
        await InventoryProduct.updateMany(
            { _id: { $in: winnerIds } },
            { $set: { "seller.isBuyBoxWinner": true } }
        ).session(session || null);

        const winnersList = allProducts.filter((p) =>
            winnerIds.some((wid) => wid.equals(p._id))
        );
        for (const prod of winnersList) {
            emitBuyBoxUpdated(prod.product.toString(), {
                sellerId: vendorId,
                isBuyBoxWinner: true,
            });
        }
    }

    if (loserIds.length > 0) {
        await InventoryProduct.updateMany(
            { _id: { $in: loserIds } },
            { $set: { "seller.isBuyBoxWinner": false } }
        ).session(session || null);

        const losersList = allProducts.filter((p) =>
            loserIds.some((lid) => lid.equals(p._id))
        );
        for (const prod of losersList) {
            emitBuyBoxUpdated(prod.product.toString(), {
                sellerId: vendorId,
                isBuyBoxWinner: false,
            });
        }
    }

    return {
        eligible: true,
        message: "Buy Box assigned successfully.",
        assignedCount: winnerIds.length,
    };
};

// ─── Inventory CRUD ──────────────────────────────────────────────────────────

const listProductIntoDB = async (user: JwtPayload, payload: TInventoryProduct) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }
    if (isUserExists.role !== USER_ROLE.VENDOR) {
        throw new AppError(httpStatus.FORBIDDEN, "this user not authorised to list product");
    }

    const isProduct = await Product.findOne({ asin: payload?.asin });

    if (!isProduct) {
        throw new AppError(httpStatus.NOT_FOUND, "this asin product not found");
    }

    const data = {
        product: isProduct._id,
        asin: isProduct.asin,
        seller: {
            vendor: isUserExists._id,
            price: payload?.seller?.price,
            quantity: payload?.seller?.quantity,
            isStock: payload?.seller?.isStock,
            fulfillmentBy: isUserExists?.name,
            shippingTime: payload?.seller?.shippingTime,
        },
    };

    const result = await InventoryProduct.create(data);

    if (result?.seller?.vendor) {
        try {
            await calculateBuyBox(result.seller.vendor.toString());
        } catch (error) {
            console.error("[Inventory Service] Buy Box recalculation failed on listing:", error);
        }
    }

    return result;
};

const allInventoryProductsFromDB = async (query: Record<string, unknown>) => {
    const inventoryProductQuery = new QueryBuilder(
        InventoryProduct.find().populate("product").populate("user", "name avatar"),
        query
    )
        .search([""])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await inventoryProductQuery.countTotal();
    const data = await inventoryProductQuery.modelQuery;

    return { meta, data };
};

const updatePriceIntoDB = async (
    user: JwtPayload,
    id: string,
    payload: { price: number }
) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }
    if (isUserExists.role !== USER_ROLE.VENDOR) {
        throw new AppError(httpStatus.FORBIDDEN, "this user not authorized to update inventory");
    }

    const inventoryProduct = await InventoryProduct.findById(id);

    if (!inventoryProduct) {
        throw new AppError(httpStatus.NOT_FOUND, "Inventory product not found");
    }

    if (inventoryProduct.seller.vendor.toString() !== isUserExists._id?.toString()) {
        throw new AppError(
            httpStatus.UNAUTHORIZED,
            "You are not authorized to update this inventory product"
        );
    }

    const result = await InventoryProduct.findByIdAndUpdate(
        id,
        { $set: { "seller.price": payload.price } },
        { new: true, runValidators: true }
    );

    if (result?.seller?.vendor) {
        try {
            await calculateBuyBox(result.seller.vendor.toString());
            emitPriceUpdated(
                result.product.toString(),
                result.seller.vendor.toString(),
                result.seller.price
            );
        } catch (error) {
            console.error("[Inventory Service] Buy Box or socket failed for price update:", error);
        }
    }

    return result;
};

const updateQuantityIntoDB = async (
    user: JwtPayload,
    id: string,
    payload: { quantity: number }
) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }
    if (isUserExists.role !== USER_ROLE.VENDOR) {
        throw new AppError(httpStatus.FORBIDDEN, "this user not authorized to update inventory");
    }

    const inventoryProduct = await InventoryProduct.findById(id);

    if (!inventoryProduct) {
        throw new AppError(httpStatus.NOT_FOUND, "Inventory product not found");
    }

    if (inventoryProduct.seller.vendor.toString() !== isUserExists._id?.toString()) {
        throw new AppError(
            httpStatus.UNAUTHORIZED,
            "You are not authorized to update this inventory product"
        );
    }

    const result = await InventoryProduct.findByIdAndUpdate(
        id,
        {
            $set: {
                "seller.quantity": payload.quantity,
                "seller.isStock": payload.quantity > 0,
            },
        },
        { new: true, runValidators: true }
    );

    if (result?.seller?.vendor) {
        try {
            await calculateBuyBox(result.seller.vendor.toString());
            emitInventoryUpdated(
                result.product.toString(),
                result.seller.vendor.toString(),
                result.seller.quantity,
                result.seller.isStock
            );
        } catch (error) {
            console.error("[Inventory Service] Buy Box or socket failed for quantity update:", error);
        }
    }

    return result;
};

const inventoryProductsByVendorFromDB = async (
    user: JwtPayload,
    query: Record<string, unknown>
) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }
    const invenProductQuery = new QueryBuilder(
        InventoryProduct.find().populate("product").populate("user", "name avatar"),
        query
    )
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await invenProductQuery.countTotal();
    const data = await invenProductQuery.modelQuery;

    return { meta, data };
};

export const InventoryServices = {
    listProductIntoDB,
    allInventoryProductsFromDB,
    updatePriceIntoDB,
    updateQuantityIntoDB,
    inventoryProductsByVendorFromDB,
    // Exported so health.service can trigger Buy Box after health recalculation
    calculateBuyBox,
    disableAllBuyBoxForVendor,
};