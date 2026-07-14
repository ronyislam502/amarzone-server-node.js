import mongoose from "mongoose";
import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { AccountHealth } from "./health.model";
import { ServiceReview } from "../review/review.model";

const calculateVendorHealth = async (vendorId: string, session?: mongoose.ClientSession) => {
    const statsQuery = Order.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
        {
            $lookup: {
                from: "servicereviews",
                let: { orderId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$order", "$$orderId"] },
                            isDeleted: { $ne: true },
                        },
                    },
                ],
                as: "serviceReviews",
            },
        },
        {
            $addFields: {
                isDefective: {
                    $cond: {
                        if: {
                            $or: [
                                { $eq: ["$status", "REFUNDED"] },
                                { $eq: ["$paymentStatus", "REFUNDED"] },
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: "$serviceReviews",
                                                    as: "r",
                                                    cond: { $lte: ["$$r.rating", 2] },
                                                },
                                            },
                                        },
                                        0,
                                    ],
                                },
                            ],
                        },
                        then: 1,
                        else: 0,
                    },
                },
                isLate: {
                    $cond: {
                        if: {
                            $or: [
                                {
                                    $and: [
                                        { $ne: [{ $ifNull: ["$tracking.shippedAt", null] }, null] },
                                        { $gt: ["$tracking.shippedAt", "$shippedDate.to"] },
                                    ],
                                },
                                {
                                    $and: [
                                        { $eq: ["$status", "UNSHIPPED"] },
                                        { $gt: [new Date(), "$shippedDate.to"] },
                                    ],
                                },
                            ],
                        },
                        then: 1,
                        else: 0,
                    },
                },
                isCancelledBeforeShipment: {
                    $cond: {
                        if: {
                            $and: [
                                { $eq: ["$status", "CANCELLED"] },
                                { $not: [{ $ifNull: ["$tracking.shippedAt", null] }] },
                            ],
                        },
                        then: 1,
                        else: 0,
                    },
                },
                isShipped: {
                    $cond: {
                        if: {
                            $in: ["$status", ["SHIPPED", "DELIVERED", "COMPLETE", "OUT_OF_DELIVERY"]],
                        },
                        then: 1,
                        else: 0,
                    },
                },
                hasValidTracking: {
                    $cond: {
                        if: {
                            $and: [
                                { $in: ["$status", ["SHIPPED", "DELIVERED", "COMPLETE", "OUT_OF_DELIVERY"]] },
                                { $gt: [{ $strLenCP: { $ifNull: ["$tracking.trackingNumber", ""] } }, 0] },
                                { $ne: ["$tracking.courier", null] },
                            ],
                        },
                        then: 1,
                        else: 0,
                    },
                },
            },
        },
        {
            $group: {
                _id: "$vendor",
                totalOrders: { $sum: 1 },
                defectiveOrders: { $sum: "$isDefective" },
                lateShipments: { $sum: "$isLate" },
                cancelledOrders: { $sum: "$isCancelledBeforeShipment" },
                shippedOrders: { $sum: "$isShipped" },
                validTrackingOrders: { $sum: "$hasValidTracking" },
            },
        },
    ]);

    if (session) {
        statsQuery.session(session);
    }
    const statsResult = await statsQuery;

    let orderDefectRate = 0;
    let lateShipmentRate = 0;
    let cancellationRate = 0;
    let validTrackingRate = 100;
    let score = 1000;
    let status: "HEALTHY" | "AT_RISK" | "CRITICAL" | "SUSPENDED" = "HEALTHY";

    if (statsResult.length > 0) {
        const stats = statsResult[0];
        const total = stats.totalOrders;
        const shipped = stats.shippedOrders;

        orderDefectRate = total > 0 ? +((stats.defectiveOrders / total) * 100).toFixed(2) : 0;
        lateShipmentRate = shipped > 0 ? +((stats.lateShipments / shipped) * 100).toFixed(2) : 0;
        cancellationRate = total > 0 ? +((stats.cancelledOrders / total) * 100).toFixed(2) : 0;
        validTrackingRate = shipped > 0 ? +((stats.validTrackingOrders / shipped) * 100).toFixed(2) : 100;
    }

    // Query average rating and count of Service Reviews
    const reviewStatsQuery = ServiceReview.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(vendorId), isDeleted: { $ne: true } } },
        {
            $group: {
                _id: "$vendor",
                averageRating: { $avg: "$rating" },
                reviewCount: { $sum: 1 },
            },
        },
    ]);

    if (session) {
        reviewStatsQuery.session(session);
    }
    const reviewStats = await reviewStatsQuery;

    let averageRating = 5;
    let reviewCount = 0;

    if (reviewStats.length > 0) {
        averageRating = reviewStats[0].averageRating;
        reviewCount = reviewStats[0].reviewCount;
    }

    // Score deduction
    score -= orderDefectRate * 30;
    score -= lateShipmentRate * 5;
    score -= cancellationRate * 20;
    score -= (100 - validTrackingRate) * 5;

    // Service review rating deduction
    const ratingDeduction = (5 - averageRating) * 40 * Math.min(5, reviewCount);
    score -= ratingDeduction;

    score = Math.max(0, Math.min(1000, Math.round(score)));

    // Status mapping
    if (score >= 850) {
        status = "HEALTHY";
    } else if (score >= 700) {
        status = "AT_RISK";
    } else if (score >= 500) {
        status = "CRITICAL";
    } else {
        status = "SUSPENDED";
    }

    const updatedHealth = await AccountHealth.findOneAndUpdate(
        { vendor: new mongoose.Types.ObjectId(vendorId) },
        {
            $set: {
                orderDefectRate,
                lateShipmentRate,
                cancellationRate,
                validTrackingRate,
                score,
                status,
                calculatedAt: new Date(),
            },
        },
        { new: true, upsert: true, session }
    );

    try {
        const { SlaViolationServices } = await import("../violation/violation.service");
        await SlaViolationServices.evaluateSla(vendorId, {
            orderDefectRate,
            lateShipmentRate,
            cancellationRate,
            validTrackingRate,
        }, session);
    } catch (error) {
        console.error(`[Health Service SLA trigger] Failed to evaluate SLA for vendor ${vendorId}:`, error);
    }

    try {
        const { InventoryServices } = await import("../inventory/inventory.service");
        await InventoryServices.calculateBuyBox(vendorId, session);
    } catch (error) {
        console.error(`[Health Service Buy Box trigger] Failed to calculate Buy Box for vendor ${vendorId}:`, error);
    }

    return updatedHealth;
};

const getVendorHealthFromDB = async (vendorId: string) => {
    let health = await AccountHealth.findOne({ vendor: new mongoose.Types.ObjectId(vendorId) });
    if (!health) {
        health = await calculateVendorHealth(vendorId);
    }
    return health;
};

const recalculateAllVendorsHealth = async () => {
    const vendors = await User.find({ role: "VENDOR" });
    console.log(`[Health Service] Recalculating health for ${vendors.length} vendors...`);

    const results = [];
    for (const vendor of vendors) {
        try {
            const health = await calculateVendorHealth(vendor._id.toString());
            results.push(health);
        } catch (err) {
            console.error(`[Health Service] Recalculation failed for vendor ${vendor._id}: ${(err as Error).message}`);
        }
    }
    return results;
};

export const AccountHealthServices = {
    calculateVendorHealth,
    getVendorHealthFromDB,
    recalculateAllVendorsHealth,
};
