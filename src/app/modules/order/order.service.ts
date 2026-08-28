import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { ORDER_STATUS, PAYMENT_STATUS, USER_STATUS, USER_ROLE } from "../../interface/common";
import { Order } from "./order.model";
import { generateOrderNo } from "../../utilities/generateOrderNo";
import { Inventory } from "../inventory/inventory.model";
import { Variant } from "../variant/variant.model";
import { JwtPayload } from "jsonwebtoken";
import { TOrder } from "./order.interface";
import { User } from "../user/user.model";
import mongoose from "mongoose";
import { Vendor } from "../vendor/vendor.model";
import QueryBuilder from "../../builder/queryBuilder";

const createOrderIntoDB = async (user: JwtPayload, payload: Partial<TOrder>) => {

    console.log("payload", payload)
    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
    }

    const { vendor, products } = payload;
    if (!vendor || !products || !products.length) {
        throw new AppError(httpStatus.BAD_REQUEST, "Vendor and products are required");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const isVendor = await Vendor.findById(vendor).populate("user").session(session);
        let vendorStatus = (isVendor?.user as any)?.status;
        if (!isVendor) {
            const directUser = await User.findById(vendor).session(session);
            if (directUser) {
                vendorStatus = directUser.status;
            }
        }

        if (vendorStatus === USER_STATUS.SUSPENDED) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "This vendor is currently suspended and cannot accept new orders."
            );
        }
        const productDetails: {
            variant: mongoose.Types.ObjectId;
            quantity: number;
            price: number;
        }[] = [];
        let totalPrice = 0;
        let totalQuantity = 0;
        let maxShippingTime = 0;

        for (const item of products) {
            const isProductVariant = await Variant.findById(item.variant).session(session);
            if (!isProductVariant)
                throw new AppError(httpStatus.NOT_FOUND, "Product variant not found");

            const isInventoryProduct = await Inventory.findOne({
                variant: isProductVariant._id,
                "seller.vendor": vendor,
            }).session(session);

            if (!isInventoryProduct) {
                throw new AppError(
                    httpStatus.NOT_FOUND,
                    `This product variant not found from the selected vendor`
                );
            }

            if (item.quantity > isInventoryProduct.seller.quantity) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    `this product out of stock ? try again later`
                );
            }

            const unitPrice = isInventoryProduct.seller.price;
            const itemSubtotal = +(unitPrice * item.quantity).toFixed(2);

            productDetails.push({
                variant: item.variant,
                quantity: item.quantity,
                price: unitPrice,
            });

            totalPrice += itemSubtotal;
            totalQuantity += item.quantity;

            const shippingTime = isInventoryProduct.seller.shippingTime || 0;
            if (shippingTime > maxShippingTime) {
                maxShippingTime = shippingTime;
            }

            //  Stock Update
            const updatedQty = isInventoryProduct.seller.quantity - item.quantity;
            const isStock = updatedQty > 0;

            await Inventory.findByIdAndUpdate(
                isInventoryProduct._id,
                {
                    $set: {
                        "seller.quantity": updatedQty,
                        "seller.isStock": isStock,
                    },
                },
                { session }
            );
        }

        const tax = +(totalPrice + 0.88).toFixed(2);
        const commission = +(totalPrice * 0.15).toFixed(2);
        const vendorAmount = totalPrice - commission;

        const orderNo = await generateOrderNo();
        const today = new Date();

        const shippedDate = {
            from: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // tomorrow
            to: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
        };

        const deliveryDate = {
            from: new Date(shippedDate.from.getTime() + maxShippingTime * 24 * 60 * 60 * 1000),
            to: new Date(shippedDate.to.getTime() + (maxShippingTime * 3) * 24 * 60 * 60 * 1000),
        };

        const order = await Order.create(
            [
                {
                    customer: isUserExists._id,
                    vendor,
                    orderNo,
                    products: productDetails,
                    totalPrice,
                    totalQuantity,
                    vendorAmount,
                    shippedDate,
                    deliveryDate,
                    status: ORDER_STATUS.PENDING,
                    paymentStatus: PAYMENT_STATUS.PENDING,
                    transactionId: "",
                    commission,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();
        return order[0];
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new AppError(
            httpStatus.FORBIDDEN,
            `Order creation failed: ${(error as Error)?.message}`
        );
    }
};

const getAllOrdersFromDB = async () => {
    const orders = await Order.find()
        .populate("customer", " name email")
        .populate("vendor", "name email")
        .populate({
            path: "products.variant",
            populate: {
                path: "product",
                select: "title thumbnail",
            },
        });
    return orders;
};

const allOrdersByUserFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this user not found")
    }

    let userQuery = {};
    if (isUserExists.role === USER_ROLE.CUSTOMER) {
        userQuery = { customer: isUserExists._id };
    } else if (isUserExists.role === USER_ROLE.VENDOR) {
        userQuery = { vendor: isUserExists._id };
    } else {
        throw new AppError(httpStatus.FORBIDDEN, "Access denied");
    }

    const ordersQuery = new QueryBuilder(
        Order.find(userQuery)
            .populate("customer", "name email")
            .populate("vendor", "name email")
            .populate({
                path: "products.variant",
                populate: {
                    path: "product",
                    select: "title thumbnail",
                },
            }),
        query
    )
        .search(["orderNo"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await ordersQuery.countTotal();
    const result = await ordersQuery.modelQuery;

    return { meta, result };
}

export const OrderServices = {
    createOrderIntoDB,
    getAllOrdersFromDB,
    allOrdersByUserFromDB
}