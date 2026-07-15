import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Order } from "./order.model";
import { generateOrderNo } from "../../utilities/generateOrderNo";
import mongoose from "mongoose";
import { TOrder, TTracking } from "./order.interface";
import { Product } from "../product/product.model";
import { InventoryProduct } from "../inventory/inventory.model";
import { User } from "../user/user.model";
import { JwtPayload } from "jsonwebtoken";
import QueryBuilder from "../../builder/queryBuilder";
import { emitNotification } from "../../socket/socket";
import { shippingQueue } from "../../queues/shipping.queue";
import { AccountHealthServices } from "../health/health.service";
import { calculateBuyBox } from "../../utilities/buybox";
import { recalculateBestSellers } from "../product/product.service";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

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
                    status: ORDER_STATUS.PENDING,
                    paymentStatus: PAYMENT_STATUS.PENDING,
                    transactionId,
                    commission,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        if (order[0]) {
            await triggerPostOrderOperations(order[0]._id.toString());
        }

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


const allOrdersFromDB = async (query: Record<string, unknown>) => {
    const orderQuery = new QueryBuilder(
        Order.find()
            .populate("customer")
            .populate("vendor")
            .populate("products.product"),
        query
    )
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await orderQuery.countTotal();
    const data = await orderQuery.modelQuery;

    return {
        meta,
        data,
    };
};

const allOrdersByVendorFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.OK, "this user not found");
    }

    const orderVendorQuery = new QueryBuilder(
        Order.find({ vendor: isUserExists._id })
            .populate("customer")
            .populate("vendor")
            .populate("products.product"),
        query
    )
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await orderVendorQuery.countTotal();
    const data = await orderVendorQuery.modelQuery;

    return {
        meta,
        data,
    };
};

const allOrdersByCustomerFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.OK, "this user not found");
    }

    const orderCustomerQuery = new QueryBuilder(
        Order.find({ customer: isUserExists._id })
            .populate("customer")
            .populate("vendor")
            .populate("products.product"),
        query
    )
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await orderCustomerQuery.countTotal();
    const data = await orderCustomerQuery.modelQuery;

    return {
        meta,
        data,
    };
};

const updateOrderTrackingIntoDB = async (
    user: JwtPayload,
    orderId: string,
    payload: TTracking
) => {

    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const isOrderExists = await Order.findById(orderId);
    if (!isOrderExists) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found");
    }


    if (isUserExists.role === "VENDOR" && isOrderExists.vendor.toString() !== isUserExists._id?.toString()) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "You are not authorized to update this order's tracking"
        );
    }

    const trackingData = {
        ...payload,
        shippedBy: isUserExists._id,
    };

    const result = await Order.findByIdAndUpdate(
        orderId,
        {
            $set: {
                tracking: trackingData,
            },
        },
        { new: true, runValidators: true }
    );

    if (result) {
        await triggerPostOrderOperations(result._id.toString());
    }

    return result;
};

const updateOrderShippingIntoDB = async (
    user: JwtPayload,
    orderId: string,
    payload: {
        courierName?: string;
        trackingNumber?: string;
        estimatedDelivery?: string | Date;
        notes?: string;
    }
) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const isUserExists = await User.findOne({ email: user.email }).session(session);
        if (!isUserExists) {
            throw new AppError(httpStatus.NOT_FOUND, "User not found");
        }

        const isOrderExists = await Order.findById(orderId).session(session);
        if (!isOrderExists) {
            throw new AppError(httpStatus.NOT_FOUND, "Order not found");
        }

        // Verify role permissions: Vendor must own the order, Admin can update any
        const isVendor = isUserExists.role === "VENDOR";
        const isAdmin = isUserExists.role === "ADMIN" || isUserExists.role === "SUPER_ADMIN";

        if (isVendor && isOrderExists.vendor.toString() !== isUserExists._id?.toString()) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "You are not authorized to update this order's shipping info"
            );
        }

        if (!isAdmin && !isVendor) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "Only Vendors or Admins can update shipping information"
            );
        }

        // Do not allow updating tracking information if:
        // the order is CANCELLED, the order is REFUNDED, or the order is already DELIVERED.
        if (["CANCELLED", "REFUNDED", "DELIVERED"].includes(isOrderExists.status)) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Cannot update tracking details for an order that is ${isOrderExists.status}`
            );
        }

        let updateFields: Record<string, unknown> = {};

        // When status is UNSHIPPED
        if (isOrderExists.status === "UNSHIPPED") {
            if (!payload.courierName || !payload.trackingNumber) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    "Courier and Tracking Number are required for shipping"
                );
            }

            const trackingObj: Record<string, unknown> = {
                courierName: payload.courierName,
                trackingNumber: payload.trackingNumber,
                shippedBy: isUserExists._id,
                shippedAt: new Date(),
            };

            if (payload.estimatedDelivery !== undefined) {
                trackingObj.estimatedDelivery = payload.estimatedDelivery;
            }
            if (payload.notes !== undefined) {
                trackingObj.notes = payload.notes;
            }

            updateFields = {
                $set: {
                    tracking: trackingObj,
                    status: ORDER_STATUS.SHIPPED,
                },
            };
        } else if (isOrderExists.status === ORDER_STATUS.SHIPPED) {
            // When status is SHIPPED
            // If they attempt to update courier or trackingNumber, only Admin can force it
            const attemptsToChangeTrackingOrCourier =
                (payload.trackingNumber !== undefined && payload.trackingNumber !== isOrderExists.tracking?.trackingNumber) ||
                (payload.courierName !== undefined && payload.courierName !== isOrderExists.tracking?.courierName);

            if (attemptsToChangeTrackingOrCourier && !isAdmin) {
                throw new AppError(
                    httpStatus.FORBIDDEN,
                    "Only Admins can update courier and tracking number after the order has been shipped"
                );
            }

            // Set allowed tracking fields
            const updateSet: Record<string, unknown> = {};
            if (payload.estimatedDelivery !== undefined) {
                updateSet["tracking.estimatedDelivery"] = payload.estimatedDelivery;
            }
            if (payload.notes !== undefined) {
                updateSet["tracking.notes"] = payload.notes;
            }

            // Admin forces tracking or courier change
            if (isAdmin) {
                if (payload.courierName !== undefined) {
                    updateSet["tracking.courierName"] = payload.courierName;
                }
                if (payload.trackingNumber !== undefined) {
                    updateSet["tracking.trackingNumber"] = payload.trackingNumber;
                }
            }

            updateFields = {
                $set: updateSet,
            };
        } else {
            // Any other status (e.g. PENDING, etc.)
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Cannot update tracking details for an order that is ${isOrderExists.status}`
            );
        }

        const result = await Order.findByIdAndUpdate(
            orderId,
            updateFields,
            { new: true, runValidators: true, session }
        )
            .populate("customer")
            .populate("vendor");

        if (!result) {
            throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to update order shipping");
        }

        await session.commitTransaction();
        session.endSession();

        // Emit Socket.IO notification to the customer
        try {
            emitNotification(`customer:${result.customer}`, "order_shipped", {
                orderId: result._id,
                orderNo: result.orderNo,
                message: `Your order #${result.orderNo} shipping details have been updated!`,
            });
        } catch (socketError) {
            console.error(`[Order Service] Socket notification failed for order shipping:`, socketError);
        }

        // Add job to BullMQ queue for email shipping confirmation
        try {
            await shippingQueue.add(
                "sendShippingEmail",
                { orderId: result._id },
                { jobId: result._id.toString() }
            );
            console.log(`[Order Service] Enqueued shipping confirmation email for Order ID: ${result._id}`);
        } catch (queueError) {
            console.error(`[Order Service] BullMQ queue add failed for shipping confirmation email:`, queueError);
        }

        if (result) {
            await triggerPostOrderOperations(result._id.toString());
        }

        return result;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const triggerPostOrderOperations = async (orderId: string) => {
    try {
        const order = await Order.findById(orderId).populate("products.product");
        if (!order) return;

        const vendorId = order.vendor.toString();

        // 1. Recalculate Vendor Account Health
        await AccountHealthServices.calculateVendorHealth(vendorId);

        // 2. Recalculate Buy Box eligibility
        await calculateBuyBox(vendorId);

        // 3. Recalculate Best Seller
        if (order.products && order.products.length > 0) {
            const categoryIds = order.products
                .map((p: any) => p.product?.category?.toString())
                .filter(Boolean);
            const uniqueCategoryIds = [...new Set(categoryIds)];
            if (uniqueCategoryIds.length > 0) {
                await recalculateBestSellers(uniqueCategoryIds);
            }
        }
    } catch (error) {
        console.error(`[Order Service Post Operations] Error triggering post-order actions for order ${orderId}:`, error);
    }
};

export const OrderServices = {
    createOrderIntoDB,
    allOrdersFromDB,
    allOrdersByVendorFromDB,
    allOrdersByCustomerFromDB,
    updateOrderTrackingIntoDB,
    updateOrderShippingIntoDB,
    triggerPostOrderOperations,
};
