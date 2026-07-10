import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Order } from "./order.model";
import { generateOrderNo } from "../../utilities/generateOrderNo";
import mongoose from "mongoose";
import { TOrder } from "./order.interface";
import { Product } from "../product/product.model";
import { InventoryProduct } from "../inventory/inventory.model";
import { User } from "../user/user.model";
import { JwtPayload } from "jsonwebtoken";

const createOrderIntoDB = async (user: JwtPayload, payload: Partial<TOrder>) => {
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
        const productDetails: {
            product: mongoose.Types.ObjectId;
            quantity: number;
        }[] = [];
        let totalPrice = 0;
        let totalQuantity = 0;
        let maxShippingTime = 0;

        for (const item of products) {
            const isProduct = await Product.findById(item.product).session(session);
            if (!isProduct)
                throw new AppError(httpStatus.NOT_FOUND, "Product not found");

            const isInventoryProduct = await InventoryProduct.findOne({
                product: isProduct._id,
                "seller.vendor": vendor,
            }).session(session);

            if (!isInventoryProduct) {
                throw new AppError(
                    httpStatus.NOT_FOUND,
                    `This product not found from the selected vendor`
                );
            }

            if (item.quantity > isInventoryProduct.seller.quantity) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    `${isProduct.title} out of stock, available ${isInventoryProduct.seller.quantity}`
                );
            }

            productDetails.push({ product: isProduct._id, quantity: item.quantity });

            totalPrice += +(isInventoryProduct.seller.price * item.quantity).toFixed(2);
            totalQuantity += item.quantity;

            const shippingTime = isInventoryProduct.seller.shippingTime || 0;
            if (shippingTime > maxShippingTime) {
                maxShippingTime = shippingTime;
            }

            //  Stock Update
            const updatedQty = isInventoryProduct.seller.quantity - item.quantity;
            const isStock = updatedQty > 0;

            await InventoryProduct.findByIdAndUpdate(
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

        const tax = +(totalPrice * 0.1).toFixed(2);
        const grandAmount = totalPrice + tax;
        const commission = +(totalPrice * 0.15).toFixed(2);

        const orderNo = await generateOrderNo();
        const today = new Date();
        const transactionId =
            "A2Z" +
            today.getFullYear() +
            (today.getMonth() + 1) +
            today.getDate() +
            today.getHours() +
            today.getMinutes() +
            today.getSeconds();

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
                    tax,
                    totalPrice,
                    totalQuantity,
                    grandAmount,
                    shippedDate,
                    deliveryDate,
                    status: "PENDING",
                    paymentStatus: "PENDING",
                    transactionId,
                    commission,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return order[0];
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        throw new AppError(
            httpStatus.FORBIDDEN,
            `Order creation failed: ${error?.message}`
        );
    }
};



export const OrderServices = {
    createOrderIntoDB,
};
