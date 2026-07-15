import mongoose from "mongoose";
import { InventoryProduct } from "../modules/inventory/inventory.model";
import { emitBuyBoxUpdated } from "../socket/socketBuyBox";
import { Order } from "../modules/order/order.model";
import { AccountHealth } from "../modules/health/health.model";
import { ServiceReview } from "../modules/review/review.model";

const BUY_BOX_CONFIG = {
    minCompletedOrders: 20,
    minAccountHealthScore: 850,
    maxOrderDefectRate: 1.0,
    maxCancellationRate: 2.5,
    maxLateShipmentRate: 4.0,
    minValidTrackingRate: 95.0,
    minServiceReviewRating: 4.5,
    assignmentPercentage: 25,
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
export const calculateBuyBox = async (
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