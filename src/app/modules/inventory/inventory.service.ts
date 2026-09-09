import { JwtPayload } from "jsonwebtoken";
import { TInventory } from "./inventory.interface";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { USER_ROLE, USER_STATUS } from "../../interface/common";
import { Product } from "../product/product.model";
import { Variant } from "../variant/variant.model";
import { Inventory } from "./inventory.model";
import QueryBuilder from "../../builder/queryBuilder";

const listProductIntoDB = async (user: JwtPayload, payload: TInventory) => {

    const isUserExists = await User.isUserExistsByEmail(user?.email);
    console.log("user", isUserExists)

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found");
    }

    if (isUserExists.role !== USER_ROLE.VENDOR) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "This user is not authorized to list product"
        );
    }

    if (isUserExists.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "User account is suspended! Cannot list inventory"
        );
    }

    const isVariantProduct = await Variant.findOne({ asin: payload?.asin });

    if (!isVariantProduct) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "Product variant not found"
        );
    }

    if (isVariantProduct.isPrivateLevel) {
        const product = await Product.findById(isVariantProduct.product);

        if (!product) {
            throw new AppError(httpStatus.NOT_FOUND, "Associated product not found");
        }

        if (product.author.name !== isUserExists.name) {
            throw new AppError(
                httpStatus.UNAUTHORIZED,
                "You are not authorized to add this private-level product to your inventory"
            );
        }
    }

    const isAlreadyListed = await Inventory.findById(isVariantProduct?._id);

    console.log('is', isAlreadyListed)

    if (isAlreadyListed) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "You have already listed this variant ASIN in your inventory"
        );
    }

    const data = {
        variant: isVariantProduct._id,
        asin: isVariantProduct.asin,
        seller: {
            vendor: isUserExists?._id,
            price: payload.seller.price,
            quantity: payload?.seller?.quantity,
            isStock: payload?.seller?.quantity > 0,
            fulfillmentBy: isUserExists?.name,
            shippingTime: payload?.seller?.shippingTime,
        }
    }

    const result = await Inventory.create(data);
    console.log('result', result)

    return result;

}

const myInventoryFromDB = async (
    user: JwtPayload,
    query: Record<string, unknown>
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This user is not found");
    }

    if (isUserExists.role !== USER_ROLE.VENDOR) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "Only vendors can view their inventory"
        );
    }

    const myInventoryQuery = new QueryBuilder(
        Inventory.find({ "seller.vendor": isUserExists._id }).populate({
            path: "variant",
            populate: {
                path: "product",
            },
        }),
        query
    )
        .search(["asin"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await myInventoryQuery.countTotal();
    const data = await myInventoryQuery.modelQuery;

    return {
        meta,
        data,
    };
};

const updatePriceIntoDB = async (
    user: JwtPayload,
    id: string,
    payload: { price: number }
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const inventory = await Inventory.findOne({
        _id: id,
        "seller.vendor": isUserExists._id,
    });

    if (!inventory) {
        throw new AppError(httpStatus.NOT_FOUND, "Inventory item not found");
    }

    inventory.seller.price = payload.price;
    await inventory.save();
    return inventory;
};

const updateQuantityIntoDB = async (
    user: JwtPayload,
    id: string,
    payload: { quantity: number }
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const inventory = await Inventory.findOne({
        _id: id,
        "seller.vendor": isUserExists._id,
    });

    if (!inventory) {
        throw new AppError(httpStatus.NOT_FOUND, "Inventory item not found");
    }

    inventory.seller.quantity = payload.quantity;
    inventory.seller.isStock = payload.quantity > 0;
    await inventory.save();
    return inventory;
};

export const InventoryServices = {
    listProductIntoDB,
    myInventoryFromDB,
    updatePriceIntoDB,
    updateQuantityIntoDB,
}