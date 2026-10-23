import mongoose from "mongoose";
import { emitBuyBoxUpdated } from "../socket/socketBuyBox";
import { Order } from "../modules/order/order.model";
import { AccountHealth } from "../modules/health/health.model";
import { User } from "../modules/user/user.model";
import { Vendor } from "../modules/vendor/vendor.model";
import { USER_STATUS, VENDOR_HEALTH, SLA_SEVERITY } from "../interface/common";
import { Inventory } from "../modules/inventory/inventory.model";
import { ServiceReview } from "../modules/serviceReview/serviceReview.model";
import { Variant } from "../modules/variant/variant.model";
import { SlaViolation } from "../modules/violation/violation.model";

export const BUY_BOX_CONFIG = {
    minCompletedOrders: 20,
    minAccountHealthScore: 850,
    maxOrderDefectRate: 1.0,
    maxCancellationRate: 2.5,
    maxLateShipmentRate: 4.0,
    minValidTrackingRate: 95.0,
    minServiceReviewRating: 4.5,
    assignmentPercentage: 25,
    minVariantDeliveredOrders: 10,
};

/**
 * Count delivered orders for a specific product variant across the platform
 */
export const getVariantDeliveredOrdersCount = async (
    variantId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
): Promise<number> => {
    return await Order.countDocuments({
        "products.variant": new mongoose.Types.ObjectId(variantId.toString()),
        status: { $in: ["COMPLETE", "DELIVERED"] },
        isDeleted: { $ne: true },
    }).session(session || null);
};

/**
 * Check whether a product variant satisfies the >= 10 delivered orders Buy Box requirement
 */
export const isVariantBuyBoxEligible = async (
    variantId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
): Promise<boolean> => {
    const count = await getVariantDeliveredOrdersCount(variantId, session);
    return count >= BUY_BOX_CONFIG.minVariantDeliveredOrders;
};

/**
 * Fetch all suspended vendor IDs (both User and Vendor IDs, plus any with suspended health or active SLA suspension)
 */
export const getSuspendedVendorIds = async (
    session?: mongoose.ClientSession
): Promise<mongoose.Types.ObjectId[]> => {
    // 1. Users with status SUSPENDED or BLOCKED
    const suspendedUsers = await User.find(
        { status: { $in: [USER_STATUS.SUSPENDED, USER_STATUS.BLOCKED] } },
        { _id: 1 }
    ).session(session || null);
    const suspendedUserIds = suspendedUsers.map((u) => u._id);

    // 2. Vendors linked to these users
    const suspendedVendors = await Vendor.find(
        { user: { $in: suspendedUserIds } },
        { _id: 1 }
    ).session(session || null);
    const vendorIds = suspendedVendors.map((v) => v._id);

    // 3. Vendors with SUSPENDED AccountHealth
    const suspendedHealths = await AccountHealth.find(
        { status: VENDOR_HEALTH.SUSPENDED },
        { vendor: 1 }
    ).session(session || null);
    const healthVendorIds = suspendedHealths.map((h) => h.vendor);

    // 4. Vendors with unresolved SUSPENSION SLA violations
    const activeSuspViolations = await SlaViolation.find(
        { severity: SLA_SEVERITY.SUSPENSION, isResolved: false },
        { vendor: 1 }
    ).session(session || null);
    const violationVendorIds = activeSuspViolations.map((v) => v.vendor);

    // Combine and deduplicate
    const allSet = new Set<string>();
    [...suspendedUserIds, ...vendorIds, ...healthVendorIds, ...violationVendorIds].forEach((id) => {
        if (id) allSet.add(id.toString());
    });

    return Array.from(allSet).map((id) => new mongoose.Types.ObjectId(id));
};

/**
 * Check if a single vendor meets all Buy Box performance and eligibility requirements
 */
export const checkVendorBuyBoxEligibility = async (
    vendorId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
): Promise<{
    eligible: boolean;
    message?: string;
    health?: any;
    completedOrdersCount?: number;
    averageServiceReviewRating?: number;
}> => {
    const vObjId = new mongoose.Types.ObjectId(vendorId.toString());

    // 0. Check vendor account status
    let vendorStatus: string | undefined;
    let isDeleted = false;
    const possibleVendorIds: mongoose.Types.ObjectId[] = [vObjId];

    const vendorDoc = await Vendor.findById(vObjId).populate("user").session(session || null);
    if (vendorDoc && vendorDoc.user) {
        vendorStatus = (vendorDoc.user as any)?.status;
        isDeleted = (vendorDoc.user as any)?.isDeleted;
        if ((vendorDoc.user as any)?._id) {
            possibleVendorIds.push(new mongoose.Types.ObjectId((vendorDoc.user as any)._id.toString()));
        }
    } else {
        const directUser = await User.findById(vObjId).session(session || null);
        if (directUser) {
            vendorStatus = directUser.status;
            isDeleted = directUser.isDeleted;
            const relVendor = await Vendor.findOne({ user: directUser._id }).session(session || null);
            if (relVendor) {
                possibleVendorIds.push(relVendor._id);
            }
        }
    }

    // Check account health status and SLA violations directly
    const healthDoc = await AccountHealth.findOne({
        vendor: { $in: possibleVendorIds },
    }).session(session || null);

    const hasSuspensionViolation = await SlaViolation.findOne({
        vendor: { $in: possibleVendorIds },
        severity: SLA_SEVERITY.SUSPENSION,
        isResolved: false,
    }).session(session || null);

    if (
        vendorStatus === USER_STATUS.SUSPENDED ||
        vendorStatus === USER_STATUS.BLOCKED ||
        isDeleted ||
        healthDoc?.status === VENDOR_HEALTH.SUSPENDED ||
        Boolean(hasSuspensionViolation)
    ) {
        return {
            eligible: false,
            message: "Vendor account is currently suspended, blocked, or has unresolved suspension violations.",
        };
    }

    // 1. Count completed/delivered orders
    const completedOrdersCount = await Order.countDocuments({
        vendor: { $in: possibleVendorIds },
        status: { $in: ["COMPLETE", "DELIVERED"] },
        isDeleted: { $ne: true },
    }).session(session || null);

    if (completedOrdersCount < BUY_BOX_CONFIG.minCompletedOrders) {
        return {
            eligible: false,
            message: `Minimum sales requirement not met. Completed: ${completedOrdersCount}/${BUY_BOX_CONFIG.minCompletedOrders}`,
        };
    }

    // 2. Fetch Account Health record
    if (!healthDoc) {
        return { eligible: false, message: "No account health record found." };
    }

    // 3. Get average Service Review rating (service reviews only, never product reviews)
    const reviewStats = await ServiceReview.aggregate([
        {
            $match: {
                vendor: { $in: possibleVendorIds },
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

    // 4. Evaluate performance SLA thresholds
    const isEligible =
        healthDoc.score >= BUY_BOX_CONFIG.minAccountHealthScore &&
        healthDoc.orderDefectRate <= BUY_BOX_CONFIG.maxOrderDefectRate &&
        healthDoc.lateShipmentRate <= BUY_BOX_CONFIG.maxLateShipmentRate &&
        healthDoc.cancellationRate <= BUY_BOX_CONFIG.maxCancellationRate &&
        healthDoc.validTrackingRate >= BUY_BOX_CONFIG.minValidTrackingRate &&
        averageServiceReviewRating >= BUY_BOX_CONFIG.minServiceReviewRating;

    if (!isEligible) {
        return {
            eligible: false,
            message: "Vendor did not meet performance thresholds.",
            health: healthDoc,
            completedOrdersCount,
            averageServiceReviewRating,
        };
    }

    return {
        eligible: true,
        message: "Vendor meets all Buy Box eligibility criteria.",
        health: healthDoc,
        completedOrdersCount,
        averageServiceReviewRating,
    };
};

/**
 * Re-evaluate and assign the Buy Box for a single variant based on price competition among eligible vendors.
 *
 * Rules:
 * 1. Checks if the variant meets minVariantDeliveredOrders (10). If not, no Buy Box winner.
 * 2. Fetches in-stock, active listings for this variant.
 * 3. Identifies eligible vendors (not suspended/blocked/deleted, meets AccountHealth score & rates,
 *    min completed orders >= 20, service review rating >= 4.5).
 * 4. Compares prices among all eligible vendors:
 *    - Lowest-priced eligible vendor wins the Buy Box: seller.isBuyBoxWinner = true.
 *    - In case of a price tie, breaks tie by highest health score, then earliest listing.
 *    - All other sellers for this variant: seller.isBuyBoxWinner = false.
 * 5. If no eligible vendors remain (or variant is ineligible):
 *    - All sellers have seller.isBuyBoxWinner = false.
 *    - Fallback logic (lowest-priced active, non-suspended seller) is applied at query/catalog level.
 */
export const recalculateBuyBoxForVariant = async (
    variantId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
) => {
    const vObjectId = new mongoose.Types.ObjectId(variantId.toString());

    // 1. Check variant delivered orders requirement
    const isVariantEligible = await isVariantBuyBoxEligible(vObjectId, session);

    // Sync isBuyBoxEligible on the Variant document
    await Variant.updateOne(
        { _id: vObjectId },
        { $set: { isBuyBoxEligible: isVariantEligible } }
    ).session(session || null);

    // 2. Fetch all non-deleted inventory listings for this variant
    const allListings = await Inventory.find({
        variant: vObjectId,
        isDeleted: { $ne: true },
    }).session(session || null);

    if (allListings.length === 0) {
        return {
            variantId: vObjectId.toString(),
            winner: null,
            message: "No listings found for variant.",
        };
    }

    // 3. Filter active, in-stock listings with valid price & quantity
    const inStockListings = allListings.filter(
        (l) => l.seller.isStock === true && l.seller.quantity > 0 && l.seller.price > 0
    );

    // If variant is not eligible or has no stock, clear any existing winners
    if (!isVariantEligible || inStockListings.length === 0) {
        const currentWinners = allListings.filter((l) => l.seller.isBuyBoxWinner === true);
        if (currentWinners.length > 0) {
            await Inventory.updateMany(
                { _id: { $in: currentWinners.map((l) => l._id) } },
                { $set: { "seller.isBuyBoxWinner": false } }
            ).session(session || null);

            for (const winner of currentWinners) {
                emitBuyBoxUpdated(vObjectId.toString(), {
                    sellerId: winner.seller.vendor.toString(),
                    isBuyBoxWinner: false,
                });
            }
        }
        return {
            variantId: vObjectId.toString(),
            winner: null,
            message: !isVariantEligible
                ? "Variant has not reached required delivered orders for Buy Box."
                : "No in-stock listings available for variant.",
        };
    }

    // 4. Evaluate vendor eligibility for each in-stock listing
    const vendorEligibilityCache = new Map<string, { eligible: boolean; score: number }>();
    const eligibleCandidates: Array<{
        listing: (typeof allListings)[0];
        score: number;
    }> = [];

    for (const listing of inStockListings) {
        const vIdStr = listing.seller.vendor.toString();
        if (!vendorEligibilityCache.has(vIdStr)) {
            const check = await checkVendorBuyBoxEligibility(vIdStr, session);
            vendorEligibilityCache.set(vIdStr, {
                eligible: check.eligible,
                score: check.health?.score || 0,
            });
        }
        const cached = vendorEligibilityCache.get(vIdStr)!;
        if (cached.eligible) {
            eligibleCandidates.push({
                listing,
                score: cached.score,
            });
        }
    }

    // 5. Price competition among eligible candidates
    if (eligibleCandidates.length > 0) {
        // Sort: lowest price wins; secondary: highest health score; tertiary: oldest listing
        eligibleCandidates.sort((a, b) => {
            if (a.listing.seller.price !== b.listing.seller.price) {
                return a.listing.seller.price - b.listing.seller.price;
            }
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            const aTime = (a.listing as any).createdAt ? new Date((a.listing as any).createdAt).getTime() : 0;
            const bTime = (b.listing as any).createdAt ? new Date((b.listing as any).createdAt).getTime() : 0;
            return aTime - bTime;
        });

        const winningCandidate = eligibleCandidates[0];
        const winnerListing = winningCandidate.listing;
        const winnerId = winnerListing._id;
        const winnerVendorId = winnerListing.seller.vendor.toString();

        // If winner changed or was not winner yet, set it to true
        if (!winnerListing.seller.isBuyBoxWinner) {
            await Inventory.updateOne(
                { _id: winnerId },
                { $set: { "seller.isBuyBoxWinner": true } }
            ).session(session || null);

            emitBuyBoxUpdated(vObjectId.toString(), {
                sellerId: winnerVendorId,
                isBuyBoxWinner: true,
                price: winnerListing.seller.price,
            });
        }

        // All other listings for this variant must be false
        const losersToDemote = allListings.filter(
            (l) => !l._id.equals(winnerId) && l.seller.isBuyBoxWinner === true
        );

        if (losersToDemote.length > 0) {
            await Inventory.updateMany(
                { _id: { $in: losersToDemote.map((l) => l._id) } },
                { $set: { "seller.isBuyBoxWinner": false } }
            ).session(session || null);

            for (const loser of losersToDemote) {
                emitBuyBoxUpdated(vObjectId.toString(), {
                    sellerId: loser.seller.vendor.toString(),
                    isBuyBoxWinner: false,
                });
            }
        }

        return {
            variantId: vObjectId.toString(),
            winner: {
                inventoryId: winnerId.toString(),
                vendorId: winnerVendorId,
                price: winnerListing.seller.price,
            },
            message: "Buy Box awarded to lowest-priced eligible vendor.",
        };
    } else {
        // No eligible vendors remain. Demote any previously assigned winner.
        const previousWinners = allListings.filter((l) => l.seller.isBuyBoxWinner === true);
        if (previousWinners.length > 0) {
            await Inventory.updateMany(
                { _id: { $in: previousWinners.map((l) => l._id) } },
                { $set: { "seller.isBuyBoxWinner": false } }
            ).session(session || null);

            for (const prev of previousWinners) {
                emitBuyBoxUpdated(vObjectId.toString(), {
                    sellerId: prev.seller.vendor.toString(),
                    isBuyBoxWinner: false,
                });
            }
        }

        return {
            variantId: vObjectId.toString(),
            winner: null,
            message: "No eligible vendors meet Buy Box criteria. Fallback to lowest price applies.",
        };
    }
};

/**
 * Automatically handle vendor suspension or disqualification:
 * 1. Sets seller.isBuyBoxWinner: false for all listings of this vendor.
 * 2. Emits socket updates for each variant that this vendor lost.
 * 3. Finds all variants this vendor was selling.
 * 4. Re-evaluates Buy Box for every one of those variants:
 *    - Removes suspended vendor from competition.
 *    - Evaluates remaining eligible vendors.
 *    - Selects the new winner with the lowest price and sets seller.isBuyBoxWinner: true.
 *    - If no eligible vendor remains, applies fallback (all isBuyBoxWinner: false).
 */
export const disableAllBuyBoxForVendorAndReassign = async (
    vendorId: string | mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
) => {
    // Resolve vendor user ID in case Vendor doc ID was passed
    const vendorDoc = await Vendor.findById(vendorId).session(session || null);
    const targetVendorIds: mongoose.Types.ObjectId[] = [new mongoose.Types.ObjectId(vendorId.toString())];
    if (vendorDoc?.user) {
        targetVendorIds.push(new mongoose.Types.ObjectId(vendorDoc.user.toString()));
    }
    const directUser = await User.findById(vendorId).session(session || null);
    if (directUser) {
        const relVendors = await Vendor.find({ user: directUser._id }).session(session || null);
        for (const rv of relVendors) {
            targetVendorIds.push(rv._id);
        }
    }

    const products = await Inventory.find({
        "seller.vendor": { $in: targetVendorIds },
        isDeleted: { $ne: true },
    }).session(session || null);

    const affectedVariantIds = Array.from(
        new Set(products.map((prod) => prod.variant.toString()))
    );

    // 1. Demote all listings for this suspended vendor
    await Inventory.updateMany(
        {
            "seller.vendor": { $in: targetVendorIds },
            isDeleted: { $ne: true },
        },
        { $set: { "seller.isBuyBoxWinner": false } }
    ).session(session || null);

    for (const prod of products) {
        emitBuyBoxUpdated(prod.variant.toString(), {
            sellerId: vendorId.toString(),
            isBuyBoxWinner: false,
        });
    }

    // 2. Automatically reassign Buy Box for each affected variant
    for (const vId of affectedVariantIds) {
        try {
            await recalculateBuyBoxForVariant(vId, session);
        } catch (recalcErr) {
            console.error(`[Buy Box Reassign] Failed to recalculate variant ${vId}:`, recalcErr);
        }
    }
};

// Alias for backwards compatibility
export const disableAllBuyBoxForVendor = disableAllBuyBoxForVendorAndReassign;

/**
 * Buy Box: Core calculation for a vendor.
 * Evaluates vendor eligibility and re-runs variant price competition for all variants this vendor sells.
 */
export const calculateBuyBox = async (
    vendorId: string,
    session?: mongoose.ClientSession
) => {
    // 0. Check if vendor account is suspended
    const vendorDoc = await Vendor.findById(vendorId).populate("user").session(session || null);
    let vendorStatus = (vendorDoc?.user as any)?.status;
    if (!vendorDoc) {
        const directUser = await User.findById(vendorId).session(session || null);
        if (directUser) {
            vendorStatus = directUser.status;
        }
    }

    if (vendorStatus === USER_STATUS.SUSPENDED || vendorStatus === USER_STATUS.BLOCKED) {
        await disableAllBuyBoxForVendorAndReassign(vendorId, session);
        return { eligible: false, message: "Vendor account is currently suspended or blocked." };
    }

    // 1. Evaluate vendor eligibility
    const check = await checkVendorBuyBoxEligibility(vendorId, session);
    if (!check.eligible) {
        await disableAllBuyBoxForVendorAndReassign(vendorId, session);
        return { eligible: false, message: check.message };
    }

    // 2. Find all non-deleted inventory products for this vendor
    const allProducts = await Inventory.find({
        "seller.vendor": new mongoose.Types.ObjectId(vendorId),
        isDeleted: { $ne: true },
    }).session(session || null);

    if (allProducts.length === 0) {
        return { eligible: true, message: "Vendor is eligible but has no inventory." };
    }

    // 3. For every variant this vendor sells, recalculate Buy Box with price competition
    const variantIds = Array.from(
        new Set(allProducts.map((p) => p.variant.toString()))
    );

    let assignedCount = 0;
    for (const vId of variantIds) {
        const res = await recalculateBuyBoxForVariant(vId, session);
        if (res.winner && res.winner.vendorId === vendorId) {
            assignedCount++;
        }
    }

    return {
        eligible: true,
        message: "Buy Box evaluated successfully with price competition.",
        assignedCount,
    };
};

/**
 * Automatically check all vendors in the database, identify suspended vendors,
 * remove their isBuyBoxWinner status, and reassign the Buy Box for all affected variants
 * to the next eligible competitor following existing health and price competition rules.
 */
export const checkAndReassignBuyBoxForSuspendedVendors = async (
    session?: mongoose.ClientSession
) => {
    // 1. Identify all suspended / blocked vendor IDs
    const suspendedIds = await getSuspendedVendorIds(session);

    // Fetch details of suspended vendors for the report
    const suspendedUsers = await User.find(
        { _id: { $in: suspendedIds } },
        { _id: 1, email: 1, name: 1, status: 1 }
    ).session(session || null);

    const suspendedVendorsList = suspendedUsers.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: (u as any).name,
        status: u.status,
    }));

    // 2. Find all inventory items belonging to suspended vendors
    const suspendedListings = await Inventory.find({
        "seller.vendor": { $in: suspendedIds },
        isDeleted: { $ne: true },
    }).session(session || null);

    // 3. If any suspended listing has isBuyBoxWinner: true, update to false
    const winningSuspendedListings = suspendedListings.filter(
        (l) => l.seller.isBuyBoxWinner === true
    );

    let demotedCount = 0;
    if (winningSuspendedListings.length > 0) {
        await Inventory.updateMany(
            { _id: { $in: winningSuspendedListings.map((l) => l._id) } },
            { $set: { "seller.isBuyBoxWinner": false } }
        ).session(session || null);
        demotedCount = winningSuspendedListings.length;

        for (const listing of winningSuspendedListings) {
            emitBuyBoxUpdated(listing.variant.toString(), {
                sellerId: listing.seller.vendor.toString(),
                isBuyBoxWinner: false,
            });
        }
    }

    // 4. Collect all unique variants affected by these suspended vendors
    const affectedVariantIds = Array.from(
        new Set(suspendedListings.map((l) => l.variant.toString()))
    );

    // 5. For each affected variant, re-evaluate Buy Box
    const reassignedResults: Array<{
        variantId: string;
        previousWinner: string | null;
        newWinner: {
            inventoryId: string;
            vendorId: string;
            price: number;
        } | null;
        message: string;
    }> = [];

    for (const variantId of affectedVariantIds) {
        // Track previous winner
        const previousWinnerListing = await Inventory.findOne({
            variant: new mongoose.Types.ObjectId(variantId),
            "seller.isBuyBoxWinner": true,
            isDeleted: { $ne: true },
        }).session(session || null);

        const previousWinner = previousWinnerListing
            ? previousWinnerListing.seller.vendor.toString()
            : null;

        const recalcResult = await recalculateBuyBoxForVariant(variantId, session);

        reassignedResults.push({
            variantId,
            previousWinner,
            newWinner: recalcResult.winner,
            message: recalcResult.message,
        });
    }

    return {
        suspendedVendors: suspendedVendorsList,
        demotedListingsCount: demotedCount,
        affectedVariantsCount: affectedVariantIds.length,
        reassignedResults,
    };
};
