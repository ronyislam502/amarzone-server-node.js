import mongoose from "mongoose";
import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { AccountHealth } from "./health.model";

const calculateVendorHealth = async (vendorId: string, session?: mongoose.ClientSession) => {
    const statsQuery = Order.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
        {
            $lookup: {
                from: "servicereviews",
                localField: "_id",
                foreignField: "order",
                as: "serviceReviews",
            },
        },
        {
            $lookup: {
                from: "productreviews",
                localField: "_id",
                foreignField: "order",
                as: "productReviews",
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
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $filter: {
                                                    input: "$productReviews",
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

        // Score deduction
        score -= orderDefectRate * 30;
        score -= lateShipmentRate * 5;
        score -= cancellationRate * 20;
        score -= (100 - validTrackingRate) * 5;

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
