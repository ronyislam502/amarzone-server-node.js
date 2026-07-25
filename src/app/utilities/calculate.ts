import { Category } from "../modules/category/category.model";
import { InventoryProduct } from "../modules/inventory/inventory.model";
import { Order } from "../modules/order/order.model";
import { Product } from "../modules/product/product.model";
import { emitBestSellerUpdated, emitCategoryBestSellerUpdated } from "../socket/socketBestSeller";

export const recalculateBestSellers = async (categoryIds?: string[]) => {
    try {
        // 1. Determine categories to process
        let targetCategoryIds: string[] = [];
        if (categoryIds && categoryIds.length > 0) {
            targetCategoryIds = [...new Set(categoryIds)];
        } else {
            const categories = await Category.find({}, { _id: 1 });
            targetCategoryIds = categories.map((c) => c._id.toString());
        }

        if (targetCategoryIds.length === 0) return;

        // 2. Fetch completed orders sales metrics (status must be COMPLETE or DELIVERED)
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
                    _id: "$products.product",
                    totalCompletedSales: { $sum: "$products.quantity" },
                    recentSalesVelocity: {
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

        // Create lookup maps for sales metrics
        const salesMap = new Map<string, { totalCompletedSales: number; recentSalesVelocity: number }>();
        for (const item of salesData) {
            if (item._id) {
                salesMap.set(item._id.toString(), {
                    totalCompletedSales: item.totalCompletedSales,
                    recentSalesVelocity: item.recentSalesVelocity,
                });
            }
        }

        // 3. Fetch stock levels for all products
        const stockData = await InventoryProduct.aggregate([
            {
                $match: {
                    isDeleted: { $ne: true },
                },
            },
            {
                $group: {
                    _id: "$product",
                    totalAvailableStock: { $sum: "$seller.quantity" },
                },
            },
        ]);

        // Create lookup map for stock levels
        const stockMap = new Map<string, number>();
        for (const item of stockData) {
            if (item._id) {
                stockMap.set(item._id.toString(), item.totalAvailableStock);
            }
        }

        // 4. Recalculate for each category
        for (const categoryId of targetCategoryIds) {
            const products = await Product.find({
                category: categoryId,
                isDeleted: { $ne: true },
            });

            if (products.length === 0) continue;

            let maxScore = 0;
            const productScores: { productId: string; score: number; oldIsBestSeller: boolean }[] = [];

            for (const p of products) {
                const pIdStr = p._id.toString();
                const sales = salesMap.get(pIdStr) || { totalCompletedSales: 0, recentSalesVelocity: 0 };
                const stock = stockMap.get(pIdStr) || 0;

                let score = 0;
                // Only eligible if stock is available and they have at least one completed sale
                if (stock > 0 && sales.totalCompletedSales > 0) {
                    score = sales.totalCompletedSales + (sales.recentSalesVelocity * 2.0);
                }

                if (score > maxScore) {
                    maxScore = score;
                }

                productScores.push({
                    productId: pIdStr,
                    score,
                    oldIsBestSeller: !!p.isBestSeller,
                });
            }

            const bestSellerProductIds: string[] = [];

            // Update the database and emit socket events if state changes
            for (const item of productScores) {
                const isBest = maxScore > 0 && item.score === maxScore;
                if (isBest) {
                    bestSellerProductIds.push(item.productId);
                }

                if (isBest !== item.oldIsBestSeller) {
                    await Product.updateOne(
                        { _id: item.productId },
                        { $set: { isBestSeller: isBest } }
                    );
                    emitBestSellerUpdated(item.productId, isBest);
                }
            }

            // Check if the set of best sellers for this category has changed
            const oldBestSellers = productScores.filter(item => item.oldIsBestSeller).map(item => item.productId);
            const hasChanged =
                oldBestSellers.length !== bestSellerProductIds.length ||
                !oldBestSellers.every((id) => bestSellerProductIds.includes(id));

            if (hasChanged) {
                emitCategoryBestSellerUpdated(categoryId, bestSellerProductIds);
            }
        }
    } catch (error) {
        console.error("[Product Service] Error in recalculateBestSellers:", error);
    }
};