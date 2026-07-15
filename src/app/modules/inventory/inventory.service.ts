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
import {
    emitPriceUpdated,
    emitInventoryUpdated,
} from "../../socket/socketBuyBox";
import { calculateBuyBox } from "../../utilities/buybox";
import { recalculateBestSellers } from "../product/product.service";



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

    if (result) {
        try {
            await recalculateBestSellers([isProduct.category.toString()]);
        } catch (error) {
            console.error("[Inventory Service] Bestseller recalculation failed on listing:", error);
        }
        if (result.seller?.vendor) {
            try {
                await calculateBuyBox(result.seller.vendor.toString());
            } catch (error) {
                console.error("[Inventory Service] Buy Box recalculation failed on listing:", error);
            }
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

    if (result) {
        try {
            const prod = await Product.findById(result.product);
            if (prod) {
                await recalculateBestSellers([prod.category.toString()]);
            }
        } catch (error) {
            console.error("[Inventory Service] Bestseller recalculation failed for quantity update:", error);
        }
        if (result.seller?.vendor) {
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
};