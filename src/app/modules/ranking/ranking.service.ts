import mongoose from "mongoose";
import { Order } from "../order/order.model";
import { Variant } from "../variant/variant.model";
import { Product } from "../product/product.model";
import { Category } from "../category/category.model";
import { Department } from "../department/department.model";
import { Inventory } from "../inventory/inventory.model";
import { ProductReview } from "../productReview/productReview.model";
import { Ranking } from "./ranking.model";
import { emitBestSellerUpdated, emitCategoryBestSellerUpdated } from "../../socket/socketBestSeller";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";

/**
 * Recalculate Global, Department, and Category Rankings at the Variant level
 */
const recalculateAllBSR = async () => {
    try {
        console.log("[Ranking Service] Starting Product Variant BSR recalculation (Global, Department, Category)...");

        // 1. Aggregate sales metrics per variant from completed/delivered orders
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const salesData = await Order.aggregate([
            {
                $match: {
                    status: { $in: ["COMPLETE", "DELIVERED"] },
                    isDeleted: { $ne: true },
                },
            },
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.variant",
                    totalSalesCount: { $sum: "$products.quantity" },
                    recentSalesCount: {
                        $sum: {
                            $cond: [
                                { $gte: ["$createdAt", thirtyDaysAgo] },
                                "$products.quantity",
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        const salesMap = new Map<string, { totalSalesCount: number; recentSalesCount: number }>();
        for (const item of salesData) {
            if (item._id) {
                salesMap.set(item._id.toString(), {
                    totalSalesCount: item.totalSalesCount,
                    recentSalesCount: item.recentSalesCount,
                });
            }
        }

        // 2. Aggregate available stock per variant from Inventory across all sellers
        const stockData = await Inventory.aggregate([
            {
                $match: {
                    isDeleted: { $ne: true },
                    "seller.isStock": { $ne: false },
                },
            },
            {
                $group: {
                    _id: "$variant",
                    totalAvailableStock: { $sum: "$seller.quantity" },
                },
            },
        ]);

        const stockMap = new Map<string, number>();
        for (const item of stockData) {
            if (item._id) {
                stockMap.set(item._id.toString(), item.totalAvailableStock);
            }
        }

        // 3. Fetch all active Variants with parent Product's department & category
        const allVariants = await Variant.find({ isDeleted: { $ne: true } })
            .populate({
                path: "product",
                match: { isDeleted: { $ne: true } },
                select: "_id department category title brand isBestSeller",
            })
            .lean();

        const validVariants = allVariants.filter(
            (v: any) => v.product && v.product.department && v.product.category
        );

        if (validVariants.length === 0) {
            console.log("[Ranking Service] No active variants found to rank.");
            return {
                totalVariantsRanked: 0,
                categoriesRanked: 0,
                departmentsRanked: 0,
            };
        }

        // 4. Compute sales score per variant
        type ScoredVariant = {
            variantId: string;
            variantObjectId: mongoose.Types.ObjectId;
            asin: string;
            productId: string;
            productObjectId: mongoose.Types.ObjectId;
            departmentId: string;
            departmentObjectId: mongoose.Types.ObjectId;
            categoryId: string;
            categoryObjectId: mongoose.Types.ObjectId;
            isBuyBoxEligible: boolean;
            totalSalesCount: number;
            recentSalesCount: number;
            salesScore: number;
            inStock: boolean;
            createdAt: Date;
        };

        const scoredVariants: ScoredVariant[] = validVariants.map((v: any) => {
            const vIdStr = v._id.toString();
            const prod = v.product;
            const sales = salesMap.get(vIdStr) || { totalSalesCount: 0, recentSalesCount: 0 };
            const stock = stockMap.get(vIdStr) || 0;
            const inStock = stock > 0;

            // Velocity formula: Recent 30-day velocity * 2.0 + total lifetime units sold
            // Variants without Buy Box eligibility are still ranked based on their sales
            const salesScore = inStock
                ? sales.recentSalesCount * 2.0 + sales.totalSalesCount
                : 0;

            return {
                variantId: vIdStr,
                variantObjectId: v._id as mongoose.Types.ObjectId,
                asin: v.asin || "",
                productId: prod._id.toString(),
                productObjectId: prod._id as mongoose.Types.ObjectId,
                departmentId: prod.department.toString(),
                departmentObjectId: prod.department as mongoose.Types.ObjectId,
                categoryId: prod.category.toString(),
                categoryObjectId: prod.category as mongoose.Types.ObjectId,
                isBuyBoxEligible: !!v.isBuyBoxEligible,
                totalSalesCount: sales.totalSalesCount,
                recentSalesCount: sales.recentSalesCount,
                salesScore,
                inStock,
                createdAt: v.createdAt || new Date(0),
            };
        });

        // 5. GLOBAL RANK: Rank variant against ALL eligible variants across entire marketplace
        const globalSorted = [...scoredVariants].sort((a, b) => {
            if (b.salesScore !== a.salesScore) return b.salesScore - a.salesScore;
            if (b.totalSalesCount !== a.totalSalesCount) return b.totalSalesCount - a.totalSalesCount;
            if (b.recentSalesCount !== a.recentSalesCount) return b.recentSalesCount - a.recentSalesCount;
            return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const globalRankMap = new Map<string, number>();
        globalSorted.forEach((item, index) => {
            globalRankMap.set(item.variantId, index + 1);
        });

        // 6. DEPARTMENT RANK: Rank variant within its Department
        const departmentMap = new Map<string, ScoredVariant[]>();
        for (const sv of scoredVariants) {
            if (!departmentMap.has(sv.departmentId)) {
                departmentMap.set(sv.departmentId, []);
            }
            departmentMap.get(sv.departmentId)!.push(sv);
        }

        const deptRankMap = new Map<string, number>();
        for (const [, variantsInDept] of departmentMap.entries()) {
            variantsInDept.sort((a, b) => {
                if (b.salesScore !== a.salesScore) return b.salesScore - a.salesScore;
                if (b.totalSalesCount !== a.totalSalesCount) return b.totalSalesCount - a.totalSalesCount;
                if (b.recentSalesCount !== a.recentSalesCount) return b.recentSalesCount - a.recentSalesCount;
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

            variantsInDept.forEach((item, index) => {
                deptRankMap.set(item.variantId, index + 1);
            });
        }

        // 7. CATEGORY RANK: Rank variant within its Category & detect Best Seller
        const categoryMap = new Map<string, ScoredVariant[]>();
        for (const sv of scoredVariants) {
            if (!categoryMap.has(sv.categoryId)) {
                categoryMap.set(sv.categoryId, []);
            }
            categoryMap.get(sv.categoryId)!.push(sv);
        }

        const rankingOperations = [];
        const bestSellerProductIds = new Set<string>();
        const categoryBestSellersMap = new Map<string, string[]>();

        for (const [catId, variantsInCat] of categoryMap.entries()) {
            variantsInCat.sort((a, b) => {
                if (b.salesScore !== a.salesScore) return b.salesScore - a.salesScore;
                if (b.totalSalesCount !== a.totalSalesCount) return b.totalSalesCount - a.totalSalesCount;
                if (b.recentSalesCount !== a.recentSalesCount) return b.recentSalesCount - a.recentSalesCount;
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

            const catBestSellers: string[] = [];

            for (let i = 0; i < variantsInCat.length; i++) {
                const item = variantsInCat[i];
                const globalRank = globalRankMap.get(item.variantId) || i + 1;
                const departmentRank = deptRankMap.get(item.variantId) || i + 1;
                const categoryRank = i + 1;

                const isBestSeller = categoryRank === 1 && item.salesScore > 0 && item.inStock;
                if (isBestSeller) {
                    bestSellerProductIds.add(item.productId);
                    catBestSellers.push(item.productId);
                }

                rankingOperations.push({
                    updateOne: {
                        filter: { variant: item.variantObjectId },
                        update: {
                            $set: {
                                product: item.productObjectId,
                                asin: item.asin,
                                department: item.departmentObjectId,
                                category: item.categoryObjectId,
                                globalRank,
                                departmentRank,
                                categoryRank,
                                salesScore: item.salesScore,
                                totalSalesCount: item.totalSalesCount,
                                recentSalesCount: item.recentSalesCount,
                                isBestSeller,
                                calculatedAt: new Date(),
                            },
                        },
                        upsert: true,
                    },
                });
            }

            if (catBestSellers.length > 0) {
                categoryBestSellersMap.set(catId, catBestSellers);
            }
        }

        // 8. Execute bulk writes for Rankings
        if (rankingOperations.length > 0) {
            await Ranking.bulkWrite(rankingOperations);
        }

        // 9. Update isBestSeller on parent Product model
        const distinctProductIds = [...new Set(scoredVariants.map((sv) => sv.productId))];
        const productUpdateOperations = [];

        for (const pId of distinctProductIds) {
            const hasBestSellerVariant = bestSellerProductIds.has(pId);
            productUpdateOperations.push({
                updateOne: {
                    filter: { _id: pId },
                    update: { $set: { isBestSeller: hasBestSellerVariant } },
                },
            });
            emitBestSellerUpdated(pId, hasBestSellerVariant);
        }

        if (productUpdateOperations.length > 0) {
            await Product.bulkWrite(productUpdateOperations);
        }

        for (const [catId, bSellerIds] of categoryBestSellersMap.entries()) {
            emitCategoryBestSellerUpdated(catId, bSellerIds);
        }

        console.log(
            `[Ranking Service] Successfully recalculated Global, Department, and Category BSR for ${scoredVariants.length} variants across ${categoryMap.size} categories and ${departmentMap.size} departments.`
        );

        return {
            totalVariantsRanked: scoredVariants.length,
            categoriesRanked: categoryMap.size,
            departmentsRanked: departmentMap.size,
        };
    } catch (error) {
        console.error("[Ranking Service] Error recalculating BSR:", error);
        throw error;
    }
};

/**
 * Unified Ranking API - Retrieves all ranking information for a Variant
 * Accepts a Variant ID or ASIN.
 * Returns: Variant info, parent Product info, Global Rank, Department Rank,
 * Category Rank, Sales Score, Total Sales, Recent Sales, Best Seller status, and timestamp.
 */
const getUnifiedRankingFromDB = async (id: string) => {
    // 1. Locate the requested Variant by ID or ASIN
    let variantDoc: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
        variantDoc = await Variant.findById(id).populate({
            path: "product",
            populate: [{ path: "category" }, { path: "department" }],
        });
    }

    if (!variantDoc) {
        variantDoc = await Variant.findOne({ asin: id }).populate({
            path: "product",
            populate: [{ path: "category" }, { path: "department" }],
        });
    }

    if (!variantDoc) {
        throw new AppError(httpStatus.NOT_FOUND, "Product variant not found");
    }

    // 2. Fetch pre-calculated ranking or trigger on-the-fly calculation
    const variantId = variantDoc._id.toString();
    let ranking = await Ranking.findOne({ variant: variantId })
        .populate("category", "name icon")
        .populate("department", "name")
        .populate("product", "title brand thumbnail isBestSeller")
        .lean();

    if (!ranking) {
        await recalculateAllBSR();
        ranking = await Ranking.findOne({ variant: variantId })
            .populate("category", "name icon")
            .populate("department", "name")
            .populate("product", "title brand thumbnail isBestSeller")
            .lean();
    }

    const prod = (variantDoc.product as any) || ranking?.product;
    const categoryName = (ranking?.category as any)?.name || prod?.category?.name || "Category";
    const departmentName = (ranking?.department as any)?.name || prod?.department?.name || "Department";
    const globalRank = ranking?.globalRank || 0;
    const departmentRank = ranking?.departmentRank || 0;
    const categoryRank = ranking?.categoryRank || 0;

    // 3. Return unified Variant Ranking payload (strictly no vendor data)
    return {
        variantId: variantDoc._id,
        asin: variantDoc.asin,
        sku: variantDoc.sku,
        isBuyBoxEligible: variantDoc.isBuyBoxEligible,
        attributes: variantDoc.attributes || [],
        images: variantDoc.images || [],
        product: {
            productId: prod?._id,
            title: prod?.title,
            brand: prod?.brand,
            thumbnail: prod?.thumbnail,
            isBestSeller: !!ranking?.isBestSeller,
        },
        globalRank,
        formattedGlobalRank: globalRank > 0 ? `#${globalRank} in the entire marketplace` : "Unranked in marketplace",
        departmentRank,
        departmentName,
        formattedDepartmentRank: departmentRank > 0 ? `#${departmentRank} in ${departmentName}` : `Unranked in ${departmentName}`,
        categoryRank,
        categoryName,
        formattedCategoryRank: categoryRank > 0 ? `#${categoryRank} in ${categoryName}` : `Unranked in ${categoryName}`,
        globalRanking: {
            rank: globalRank,
            scope: "Entire Marketplace",
            formattedRank: globalRank > 0 ? `#${globalRank} in the entire marketplace` : "Unranked in marketplace",
        },
        departmentRanking: {
            departmentId: prod?.department?._id || (ranking?.department as any)?._id,
            departmentName,
            rank: departmentRank,
            formattedRank: departmentRank > 0 ? `#${departmentRank} in ${departmentName}` : `Unranked in ${departmentName}`,
        },
        categoryRanking: {
            categoryId: prod?.category?._id || (ranking?.category as any)?._id,
            categoryName,
            rank: categoryRank,
            formattedRank: categoryRank > 0 ? `#${categoryRank} in ${categoryName}` : `Unranked in ${categoryName}`,
        },
        isBestSeller: !!ranking?.isBestSeller,
        salesScore: ranking?.salesScore || 0,
        totalSalesCount: ranking?.totalSalesCount || 0,
        recentSalesCount: ranking?.recentSalesCount || 0,
        calculatedAt: ranking?.calculatedAt || new Date(),
    };
};

/**
 * Enriches ranking documents with inventory pricing (lowest / Buy Box winner),
 * review stats (averageRating, totalReviews), and formatted product/variant attributes.
 */
const enrichRankingVariants = async (rankings: any[]) => {
    if (!rankings || rankings.length === 0) {
        return [];
    }

    const variantIds = rankings
        .map((r) => r.variant?._id || r.variant)
        .filter(Boolean);
    const variantIdStrings = variantIds.map((id: any) => id.toString());
    const variantObjectIds = variantIdStrings.map((id: string) => new mongoose.Types.ObjectId(id));

    // 1. Fetch available stock & lowest/buy-box price from Inventory
    const inventoryListings = await Inventory.find({
        variant: { $in: variantObjectIds },
        isDeleted: { $ne: true },
        "seller.isStock": { $ne: false },
        "seller.price": { $gt: 0 },
    })
        .select("variant asin seller.price seller.isBuyBoxWinner")
        .lean();

    const listingsByVariantId = new Map<string, any[]>();
    for (const listing of inventoryListings) {
        if (listing.variant) {
            const vKey = listing.variant.toString();
            if (!listingsByVariantId.has(vKey)) {
                listingsByVariantId.set(vKey, []);
            }
            listingsByVariantId.get(vKey)!.push(listing);
        }
    }

    // 2. Fetch rating and review counts from ProductReview
    const reviewStats = await ProductReview.aggregate([
        {
            $match: {
                variant: { $in: [...variantObjectIds, ...variantIdStrings] },
                isDeleted: { $ne: true },
            },
        },
        {
            $group: {
                _id: "$variant",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const ratingsMap = new Map<string, { averageRating: number; totalReviews: number }>();
    for (const stat of reviewStats) {
        if (stat._id) {
            ratingsMap.set(stat._id.toString(), {
                averageRating: Math.round(Number(stat.averageRating || 0) * 10) / 10,
                totalReviews: stat.totalReviews || 0,
            });
        }
    }

    // 3. Map into enriched variant ranking objects
    return rankings.map((r: any) => {
        const variantDoc = r.variant || {};
        const productDoc = r.product || {};
        const vIdStr = (variantDoc._id || r.variant)?.toString() || "";

        const listings = listingsByVariantId.get(vIdStr) || [];
        const buyBoxWinner = listings.find((l: any) => l.seller?.isBuyBoxWinner === true);
        let lowestPriceListing: any = null;
        for (const l of listings) {
            if (!lowestPriceListing || l.seller.price < lowestPriceListing.seller.price) {
                lowestPriceListing = l;
            }
        }
        const selectedListing = buyBoxWinner || lowestPriceListing;
        const price = selectedListing?.seller?.price ?? variantDoc.price ?? null;

        const reviewInfo = ratingsMap.get(vIdStr) || {
            averageRating: variantDoc.rating ?? 0,
            totalReviews: variantDoc.totalReviews ?? 0,
        };

        const deptDoc = r.department || productDoc.department || {};
        const catDoc = r.category || productDoc.category || {};

        return {
            _id: variantDoc._id || r.variant,
            variantId: variantDoc._id || r.variant,
            productId: productDoc._id || r.product,
            asin: r.asin || variantDoc.asin,
            sku: variantDoc.sku,
            title: productDoc.title,
            brand: productDoc.brand,
            thumbnail: productDoc.thumbnail || variantDoc.images?.[0] || "",
            images: variantDoc.images?.length ? variantDoc.images : (productDoc.images || []),
            attributes: variantDoc.attributes || [],
            isBuyBoxEligible: variantDoc.isBuyBoxEligible ?? false,
            price,
            rating: reviewInfo.averageRating,
            totalReviews: reviewInfo.totalReviews,
            department: deptDoc,
            category: catDoc,
            departmentName: deptDoc.name || "",
            categoryName: catDoc.name || "",
            globalRank: r.globalRank,
            departmentRank: r.departmentRank,
            categoryRank: r.categoryRank,
            salesScore: r.salesScore,
            totalSalesCount: r.totalSalesCount,
            recentSalesCount: r.recentSalesCount,
            isBestSeller: !!r.isBestSeller,
            calculatedAt: r.calculatedAt,
            variant: variantDoc,
            product: productDoc,
        };
    });
};

/**
 * Global Best-Selling Product Variants API
 * Retrieves product variants ranked across the entire marketplace.
 * Supports pagination (page, limit) and optional filtering (department, category, isBestSeller).
 */
const bestSellingProductsVariantsFromDB = async (query: Record<string, unknown> = {}) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
        globalRank: { $gt: 0 },
    };

    if (query.department) {
        filter.department = query.department;
    }
    if (query.category) {
        filter.category = query.category;
    }
    if (query.isBestSeller !== undefined) {
        filter.isBestSeller = query.isBestSeller === "true" || query.isBestSeller === true;
    }

    let total = await Ranking.countDocuments(filter);
    if (total === 0) {
        await recalculateAllBSR();
        total = await Ranking.countDocuments(filter);
    }

    const sortOrder: Record<string, any> = {};
    if (query.sort && typeof query.sort === "string") {
        const sortField = query.sort.startsWith("-") ? query.sort.substring(1) : query.sort;
        const sortDir = query.sort.startsWith("-") ? -1 : 1;
        sortOrder[sortField] = sortDir;
    } else {
        sortOrder.globalRank = 1;
    }

    const rankings = await Ranking.find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .populate({
            path: "variant",
            match: { isDeleted: { $ne: true } },
        })
        .populate({
            path: "product",
            match: { isDeleted: { $ne: true } },
            populate: [
                { path: "department", select: "name icon" },
                { path: "category", select: "name icon" },
            ],
        })
        .populate("department", "name icon")
        .populate("category", "name icon")
        .lean();

    const data = await enrichRankingVariants(rankings);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        data,
    };
};

/**
 * Department Best-Selling Product Variants API
 * Retrieves best-selling product variants within a specific Department.
 * Supports pagination (page, limit) and optional filtering (category, isBestSeller).
 */
const bestSellingDepartmentProductsVariantsFrom = async (
    id: string,
    query: Record<string, unknown> = {}
) => {
    const isDepartment = await Department.findById(id);
    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "This department was not found");
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
        department: isDepartment._id,
        departmentRank: { $gt: 0 },
    };

    if (query.category) {
        filter.category = query.category;
    }
    if (query.isBestSeller !== undefined) {
        filter.isBestSeller = query.isBestSeller === "true" || query.isBestSeller === true;
    }

    let total = await Ranking.countDocuments(filter);
    if (total === 0) {
        await recalculateAllBSR();
        total = await Ranking.countDocuments(filter);
    }

    const sortOrder: Record<string, any> = {};
    if (query.sort && typeof query.sort === "string") {
        const sortField = query.sort.startsWith("-") ? query.sort.substring(1) : query.sort;
        const sortDir = query.sort.startsWith("-") ? -1 : 1;
        sortOrder[sortField] = sortDir;
    } else {
        sortOrder.departmentRank = 1;
    }

    const rankings = await Ranking.find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .populate({
            path: "variant",
            match: { isDeleted: { $ne: true } },
        })
        .populate({
            path: "product",
            match: { isDeleted: { $ne: true } },
            populate: [
                { path: "department", select: "name icon" },
                { path: "category", select: "name icon" },
            ],
        })
        .populate("department", "name icon")
        .populate("category", "name icon")
        .lean();

    const data = await enrichRankingVariants(rankings);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        data,
    };
};

/**
 * Category Best-Selling Product Variants API
 * Retrieves best-selling product variants within a specific Category.
 * Supports pagination (page, limit) and optional filtering (department, isBestSeller).
 */
const bestSellingCategoryProductsVariantsFrom = async (
    id: string,
    query: Record<string, unknown> = {}
) => {
    const isCategory = await Category.findById(id);
    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "This category was not found");
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
        category: isCategory._id,
        categoryRank: { $gt: 0 },
    };

    if (query.department) {
        filter.department = query.department;
    }
    if (query.isBestSeller !== undefined) {
        filter.isBestSeller = query.isBestSeller === "true" || query.isBestSeller === true;
    }

    let total = await Ranking.countDocuments(filter);
    if (total === 0) {
        await recalculateAllBSR();
        total = await Ranking.countDocuments(filter);
    }

    const sortOrder: Record<string, any> = {};
    if (query.sort && typeof query.sort === "string") {
        const sortField = query.sort.startsWith("-") ? query.sort.substring(1) : query.sort;
        const sortDir = query.sort.startsWith("-") ? -1 : 1;
        sortOrder[sortField] = sortDir;
    } else {
        sortOrder.categoryRank = 1;
    }

    const rankings = await Ranking.find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .populate({
            path: "variant",
            match: { isDeleted: { $ne: true } },
        })
        .populate({
            path: "product",
            match: { isDeleted: { $ne: true } },
            populate: [
                { path: "department", select: "name icon" },
                { path: "category", select: "name icon" },
            ],
        })
        .populate("department", "name icon")
        .populate("category", "name icon")
        .lean();

    const data = await enrichRankingVariants(rankings);

    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        data,
    };
};

export const RankingServices = {
    recalculateAllBSR,
    getUnifiedRankingFromDB,
    bestSellingProductsVariantsFromDB,
    bestSellingDepartmentProductsVariantsFrom,
    bestSellingCategoryProductsVariantsFrom,
};
