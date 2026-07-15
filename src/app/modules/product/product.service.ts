import { JwtPayload } from "jsonwebtoken";
import { TProduct } from "./product.interface";
import { USER_ROLE } from "../../interface/common";
import AppError from "../../errors/AppError";

import httpStatus from "http-status";

import { Department } from "../department/department.model";
import { User } from "../user/user.model";
import { Category } from "../category/category.model";
import { Product } from "./product.model";
import { generateASIN } from "../../utilities/generateAsin";
import { TImageFiles } from "../../interface/image.interface";
import QueryBuilder from "../../builder/queryBuilder";
import { Order } from "../order/order.model";
import { InventoryProduct } from "../inventory/inventory.model";
import { emitBestSellerUpdated, emitCategoryBestSellerUpdated } from "../../socket/socketBestSeller";


const createProductIntoDB = async (user: JwtPayload, files: TImageFiles, payload: TProduct) => {
    console.log("payload", payload)
    console.log("user", user)
    console.log("files", files)
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }

    const author = {
        role: isUserExists.role,
        id: isUserExists._id,
        name: isUserExists.role === USER_ROLE.VENDOR
            ? isUserExists.name
            : isUserExists.role === USER_ROLE.SUPER_ADMIN
                ? "Super Admin"
                : "Admin",
    }


    const isDepartment = await Department.findById(payload?.department);

    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(payload?.category);

    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(httpStatus.BAD_REQUEST, "Selected category does not belong to the selected department.");
    }

    const asin = await generateASIN(isDepartment?.name, isCategory?.name);

    // const thumbnail = files?.thumbnail[0];
    // const images = files?.images;

    // if (thumbnail && thumbnail.path) {
    //     payload.thumbnail = thumbnail.path;
    // }

    // if (images) {
    //     payload.images = images?.map((file) => file.path);
    // }

    const newProduct: TProduct = {
        ...payload,
        author,
        asin,
        isPrivateLevel: user.role === USER_ROLE.VENDOR || false,
        isDeleted: false,
    };

    const result = await Product.create(newProduct);

    if (result && result.category) {
        await recalculateBestSellers([result.category.toString()]);
    }

    return result;
};


const updateProductIntoDB = async (user: JwtPayload, id: string, files: TImageFiles, payload: Partial<TProduct>) => {
    const isProductExists = await Product.findById(id);

    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This product not found");
    }

    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }

    if (isUserExists.role === USER_ROLE.VENDOR && isProductExists.author.id?.toString() !== isUserExists._id?.toString()) {
        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized to update this product");
    }

    const departmentId = payload.department || isProductExists.department;
    const categoryId = payload.category || isProductExists.category;

    const isDepartment = await Department.findById(departmentId);
    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(categoryId);
    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(httpStatus.BAD_REQUEST, "department do not match");
    }

    if (payload.department || payload.category) {
        payload.asin = await generateASIN(isDepartment.name, isCategory.name);
    }

    // const thumbnail = files?.thumbnail?.[0];
    // const images = files?.images;

    // if (thumbnail && thumbnail.path) {
    //     payload.thumbnail = thumbnail.path;
    // }

    // if (images && images.length > 0) {
    //     payload.images = images.map((file) => file.path);
    // }

    const result = await Product.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });

    if (result && result.category) {
        const categoryIdsToRecalculate = [result.category.toString()];
        if (isProductExists.category && isProductExists.category.toString() !== result.category.toString()) {
            categoryIdsToRecalculate.push(isProductExists.category.toString());
        }
        await recalculateBestSellers(categoryIdsToRecalculate);
    }

    return result;
};

const myCreatedProductsFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }

    const productQuery = new QueryBuilder(
        Product.find({ "author.id": isUserExists._id }),
        query
    )
        .search(["title", "description", "brand"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await productQuery.countTotal();
    const data = await productQuery.modelQuery;

    return { meta, data };
};

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

export const ProductServices = {
    createProductIntoDB,
    updateProductIntoDB,
    myCreatedProductsFromDB,
    recalculateBestSellers,
};