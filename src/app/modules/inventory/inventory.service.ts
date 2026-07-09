import { JwtPayload } from "jsonwebtoken";

import { User } from "../user/user.model";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { TInventoryProduct } from "./inventory.interface";
import { USER_ROLE } from "../../interface/common";
import { InventoryProduct } from "./inventory.model";
import { Product } from "../product/product.model";
import QueryBuilder from "../../builder/queryBuilder";

const listProductIntoDB = async (user: JwtPayload, payload: TInventoryProduct) => {
    console.log("payload", payload)
    console.log("user", user)
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found")
    }
    if (isUserExists.role !== USER_ROLE.VENDOR) {
        throw new AppError(httpStatus.FORBIDDEN, "this user not authorised to list product")
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

    return result;

}

const allInventoryProductsFromDB = async (query: Record<string, unknown>) => {
    const inventoryProductQuery = new QueryBuilder(InventoryProduct.find()
        .populate("product")
        .populate("user", "name avatar"), query)
        .search([''])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await inventoryProductQuery.countTotal();
    const data = await inventoryProductQuery.modelQuery;

    return { meta, data }
}



export const InventoryServices = {
    listProductIntoDB,
    allInventoryProductsFromDB
}