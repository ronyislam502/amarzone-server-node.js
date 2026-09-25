import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { ORDER_STATUS, PAYMENT_STATUS, USER_STATUS, USER_ROLE } from "../../interface/common";
import { Order } from "./order.model";
import { generateOrderNo } from "../../utilities/generateOrderNo";
import { Inventory } from "../inventory/inventory.model";
import { Variant } from "../variant/variant.model";
import { JwtPayload } from "jsonwebtoken";
import { TOrder, TTracking } from "./order.interface";
import { User } from "../user/user.model";
import mongoose from "mongoose";
import { Vendor } from "../vendor/vendor.model";
import QueryBuilder from "../../builder/queryBuilder";
import { stripe } from "../../utilities/stripe";
import Stripe from "stripe";
import { Payment } from "../payment/payment.model";
import { AccountHealthServices } from "../health/health.service";
import { calculateBuyBox } from "../../utilities/buyBox";
import { recalculateBestSellers } from "../../utilities/calculate";
import { NotificationServices } from "../notification/notification.service";
import { emitNotification } from "../../socket/socket";
import sendEmail from "../../utilities/sendEmail";
import { invoiceQueue } from "../../redis/invoice.queue";

const createOrderIntoDB = async (user: JwtPayload, payload: Partial<TOrder>) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const isVendor = await Vendor.findById(payload?.vendor).populate("user").session(session);
        let vendorStatus = (isVendor?.user as any)?.status;
        let vendorUserId = isVendor ? (isVendor?.user as any)?._id : null;

        if (!isVendor) {
            const directUser = await User.findById(payload?.vendor).session(session);
            if (directUser) {
                vendorStatus = directUser.status;
                vendorUserId = directUser._id;
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
        const tax = 0.88;

        if (!payload.products || payload.products.length === 0) {
            throw new AppError(httpStatus.BAD_REQUEST, "Order must contain at least one product");
        }

        for (const item of payload.products) {
            const isProductVariant = await Variant.findById(item.variant).session(session);

            if (!isProductVariant)
                throw new AppError(httpStatus.NOT_FOUND, "Product variant not found");

            const isInventoryProduct = await Inventory.findOne({
                variant: isProductVariant._id,
                "seller.vendor": vendorUserId,
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

            totalPrice = itemSubtotal + tax;
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
                    vendor: vendorUserId,
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
                    tax,
                },
            ],
            { session }
        );

        let clientSecret = "";
        if (order) {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(order[0].totalPrice * 100), // Stripe expects cents
                currency: "usd",
                payment_method_types: ["card"],
                metadata: {
                    orderId: order[0]._id.toString(),
                },
            });
            clientSecret = paymentIntent.client_secret as string;
            //     const checkoutSession = await stripe.checkout.sessions.create({
            //         payment_method_types: ["card"],
            //         mode: "payment",

            //         line_items: [
            //             {
            //                 price_data: {
            //                     currency: "usd",
            //                     product_data: {
            //                         name: "Order Payment",
            //                     },
            //                     unit_amount: Math.round(totalPrice * 100),
            //                 },
            //                 quantity: 1,
            //             },
            //         ],

            //         metadata: {
            //             orderId: order[0]._id.toString(),
            //         },

            //         success_url: "http://localhost:3000/payment/success",
            //         cancel_url: "http://localhost:3000/payment/cancel",
            //     });
            //     clientSecret = checkoutSession.url as string;
        }

        if (order[0]) {
            await triggerPostOrderOperations(order[0]._id.toString());

            // Trigger Notification for Admin
            try {
                await NotificationServices.createNotificationIntoDB({
                    recipientRole: USER_ROLE.ADMIN,
                    type: "NEW_ORDER",
                    message: `A new order #${orderNo} has been placed.`,
                    relatedId: order[0]._id,
                });
            } catch (err) {
                console.error("Failed to create new order notification for admin", err);
            }

            // Trigger Notification for Vendor
            try {
                await NotificationServices.createNotificationIntoDB({
                    recipientRole: USER_ROLE.VENDOR,
                    recipientId: isVendor?._id,
                    type: "NEW_ORDER",
                    message: `You have received a new order #${orderNo}.`,
                    relatedId: order[0]._id,
                });
            } catch (err) {
                console.error("Failed to create new order notification for vendor", err);
            }
        }

        await session.commitTransaction();
        session.endSession();
        return { order: order[0], clientSecret };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new AppError(
            httpStatus.FORBIDDEN,
            `Order creation failed: ${(error as Error)?.message}`
        );
    }
};

const getAllOrdersFromDB = async (query: Record<string, unknown>) => {
    const ordersQuery = new QueryBuilder(
        Order.find()
            .populate("customer", "name email")
            .populate("vendor", "name email")
            .populate({
                path: "products.variant",
                populate: {
                    path: "product",
                    select: "title thumbnail department category",
                    populate: [
                        { path: "department", select: "name" },
                        { path: "category", select: "name" },
                    ],
                },
            }),
        query
    )
        .search(["orderNo", "transactionId"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await ordersQuery.countTotal();
    const data = await ordersQuery.modelQuery;

    return { meta, data };
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
                    select: "title thumbnail department category",
                    populate: [
                        { path: "department", select: "name" },
                        { path: "category", select: "name" },
                    ],
                },
            }),
        query
    )
        .search(["orderNo", "transactionId"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await ordersQuery.countTotal();
    const result = await ordersQuery.modelQuery;

    return { meta, result };
};

const getSingleOrderFromDB = async (user: JwtPayload, id: string) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This user not found");
    }

    const query = mongoose.Types.ObjectId.isValid(id)
        ? { $or: [{ _id: id }, { orderNo: id }] }
        : { orderNo: id };

    const order = await Order.findOne(query)
        .populate("customer", "name email")
        .populate("vendor", "name email")
        .populate("tracking.shippedBy", "name email")
        .populate({
            path: "products.variant",
            populate: {
                path: "product",
                select: "title thumbnail",
            },
        });

    if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found");
    }

    const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
    const vendorId = (order.vendor as any)?._id?.toString() || order.vendor?.toString();

    if (
        isUserExists.role === USER_ROLE.CUSTOMER &&
        customerId !== isUserExists._id.toString()
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "You are not authorized to view this order"
        );
    }

    if (
        isUserExists.role === USER_ROLE.VENDOR &&
        vendorId !== isUserExists._id.toString()
    ) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            "You are not authorized to view this order"
        );
    }

    return order;
};

const triggerPostOrderOperations = async (orderId: string) => {
    try {
        const order = await Order.findById(orderId).populate({
            path: "products.variant",
            populate: {
                path: "product",
            },
        });
        if (!order) return;

        const vendorId = order.vendor.toString();

        // 1. Recalculate Vendor Account Health
        await AccountHealthServices.calculateVendorHealth(vendorId);

        // 2. Recalculate Buy Box eligibility
        await calculateBuyBox(vendorId);

        // 3. Recalculate Best Seller
        if (order.products && order.products.length > 0) {
            const categoryIds = order.products
                .map((p: any) => p.variant?.product?.category?.toString())
                .filter(Boolean);
            const uniqueCategoryIds = [...new Set(categoryIds)];
            if (uniqueCategoryIds.length > 0) {
                await recalculateBestSellers(uniqueCategoryIds);
            }
        }

        // 4. Generate and link invoice PDF if paid and not yet generated
        if (order.paymentStatus === PAYMENT_STATUS.PAID && !order.invoiceUrl) {
            try {
                await invoiceQueue.add("processInvoice", { orderId: order._id.toString() }, { jobId: order._id.toString() });
            } catch (queueErr) {
                console.warn(`[Order Service] Could not enqueue invoice generation:`, queueErr);
            }
        }
    } catch (error) {
        console.error(`[Order Service Post Operations] Error triggering post-order actions for order ${orderId}:`, error);
    }
};

const cancelExpiredUnpaidOrders = async (days = 7) => {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find all orders where status is PENDING, payment is not completed, and created before cutoffDate
    const expiredOrders = await Order.find({
        status: ORDER_STATUS.PENDING,
        paymentStatus: { $in: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.UNPAID] },
        createdAt: { $lte: cutoffDate },
        isDeleted: false,
    }).populate("customer", "name email");

    if (!expiredOrders || expiredOrders.length === 0) {
        return { cancelledCount: 0, orderIds: [] };
    }

    console.log(`[Order Expiry] Found ${expiredOrders.length} unpaid order(s) past ${days} days. Cancelling...`);

    const cancelledOrderIds: string[] = [];

    for (const order of expiredOrders) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Mark order as CANCELLED and paymentStatus as UNPAID
            order.status = ORDER_STATUS.CANCELLED;
            order.paymentStatus = PAYMENT_STATUS.UNPAID;
            await order.save({ session });

            // 2. Replenish inventory quantity for each product variant
            if (order.products && order.products.length > 0) {
                for (const item of order.products) {
                    await Inventory.findOneAndUpdate(
                        {
                            variant: item.variant,
                            "seller.vendor": order.vendor,
                        },
                        {
                            $inc: { "seller.quantity": item.quantity },
                            $set: { "seller.isStock": true },
                        },
                        { session }
                    );
                }
            }

            await session.commitTransaction();
            session.endSession();

            cancelledOrderIds.push(order._id.toString());
            console.log(`[Order Expiry] Auto-cancelled order #${order.orderNo} (${order._id}) and restored inventory.`);

            // 3. Post-cancellation triggers (Buy Box, Best Seller, Vendor Health)
            try {
                await triggerPostOrderOperations(order._id.toString());
            } catch (opError) {
                console.error(`[Order Expiry] Post-order operations failed for #${order.orderNo}:`, opError);
            }

            // 4. In-App Notifications & Real-Time Socket.IO
            const customerIdStr = (order.customer as any)?._id?.toString() || order.customer?.toString();
            const vendorIdStr = (order.vendor as any)?._id?.toString() || order.vendor?.toString();

            if (customerIdStr) {
                try {
                    await NotificationServices.createNotificationIntoDB({
                        recipientRole: USER_ROLE.CUSTOMER,
                        recipientId: new mongoose.Types.ObjectId(customerIdStr),
                        type: "ORDER_CANCELLED" as any,
                        message: `Order #${order.orderNo} has been automatically cancelled because payment was not completed within 7 days.`,
                        relatedId: order._id,
                    });
                } catch (notifErr) {
                    console.error(`[Order Expiry] Failed to create customer notification:`, notifErr);
                }

                try {
                    emitNotification(`customer:${customerIdStr}`, "order_cancelled", {
                        orderId: order._id,
                        orderNo: order.orderNo,
                        message: `Order #${order.orderNo} was automatically cancelled due to payment expiration (7 days).`,
                    });
                } catch (sockErr) {
                    console.error(`[Order Expiry] Socket notification to customer failed:`, sockErr);
                }
            }

            if (vendorIdStr) {
                try {
                    await NotificationServices.createNotificationIntoDB({
                        recipientRole: USER_ROLE.VENDOR,
                        recipientId: new mongoose.Types.ObjectId(vendorIdStr),
                        type: "ORDER_CANCELLED" as any,
                        message: `Order #${order.orderNo} was cancelled due to payment expiration. Product stock has been restored.`,
                        relatedId: order._id,
                    });
                } catch (notifErr) {
                    console.error(`[Order Expiry] Failed to create vendor notification:`, notifErr);
                }

                try {
                    emitNotification(`vendor:${vendorIdStr}`, "order_cancelled", {
                        orderId: order._id,
                        orderNo: order.orderNo,
                        message: `Order #${order.orderNo} was cancelled due to unpaid expiration. Stock restored.`,
                    });
                } catch (sockErr) {
                    console.error(`[Order Expiry] Socket notification to vendor failed:`, sockErr);
                }
            }

            // 5. Send Email to Customer
            const customerEmail = (order.customer as any)?.email;
            const customerName = (order.customer as any)?.name || "Customer";
            if (customerEmail) {
                try {
                    const emailHtml = `
                        <h2>Order Cancellation Notice</h2>
                        <p>Hello ${customerName},</p>
                        <p>Your order <strong>#${order.orderNo}</strong> has been automatically cancelled because payment was not received within the 7-day payment window.</p>
                        <p>All items reserved for this order have been returned to inventory.</p>
                        <p>If you still wish to purchase these items, you are welcome to place a new order on Amarzone.</p>
                        <br/>
                        <p>Best regards,<br/>Amarzone Team</p>
                    `;
                    await sendEmail(customerEmail, emailHtml, `Order #${order.orderNo} Cancelled - Payment Window Expired`);
                } catch (emailErr) {
                    console.error(`[Order Expiry] Failed to send email to ${customerEmail}:`, emailErr);
                }
            }
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error(`[Order Expiry] Error during cancellation of order #${order.orderNo}:`, error);
        }
    }

    return {
        cancelledCount: cancelledOrderIds.length,
        orderIds: cancelledOrderIds,
    };
};

const updateOrderInDB = async (user: JwtPayload, id: string, payload: Partial<TTracking>) => {
    const isUser = await User.isUserExistsByEmail(user?.email);
    if (!isUser) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const isOrder = await Order.findById(id);

    if (!isOrder) {
        throw new AppError(httpStatus.NOT_FOUND, "this order not found");
    }

    if (isUser.role === USER_ROLE.VENDOR) {
        if (isOrder.vendor.toString() !== isUser._id.toString()) {
            throw new AppError(
                httpStatus.FORBIDDEN,
                "You are not authorized to update this order"
            );
        }
    }

    if (isOrder.status === ORDER_STATUS.SHIPPED) {
        throw new AppError(httpStatus.BAD_REQUEST, "this order already shipped")
    }

    const shippedAt = new Date();

    // Automatically calculate delivery date: 5 days after shipping
    const estimatedDelivery = new Date(shippedAt);
    estimatedDelivery.setDate(
        estimatedDelivery.getDate() + 5
    );


    const updatedOrder = await Order.findByIdAndUpdate(
        id,
        {
            $set: {
                tracking: {
                    trackingNumber: payload.trackingNumber,
                    courierName: payload.courierName,
                    shippedBy: isUser._id,
                    shippedAt,
                    estimatedDelivery,
                },
                status: ORDER_STATUS.SHIPPED,
            },
        },
        {
            new: true,
            runValidators: true,
        }
    );


    if (updatedOrder) {
        await triggerPostOrderOperations(updatedOrder._id.toString());
    }

    return updatedOrder;
};

const orderRefundFromDB = async (user: JwtPayload, id: string) => {
    const isUser = await User.isUserExistsByEmail(user?.email);
    if (!isUser) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    if (isUser.isDeleted || isUser.status === USER_STATUS.BLOCKED) {
        throw new AppError(httpStatus.FORBIDDEN, "User account is inactive or blocked");
    }

    const query = mongoose.Types.ObjectId.isValid(id)
        ? { $or: [{ _id: id }, { orderNo: id }] }
        : { orderNo: id };

    const order = await Order.findOne(query);
    if (!order) {
        throw new AppError(httpStatus.NOT_FOUND, "Order not found");
    }

    // Status Validations
    if (order.status === ORDER_STATUS.REFUNDED || order.paymentStatus === PAYMENT_STATUS.REFUNDED) {
        throw new AppError(httpStatus.BAD_REQUEST, "Order has already been refunded");
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
        throw new AppError(httpStatus.BAD_REQUEST, "Cannot refund a cancelled order");
    }

    if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Only paid orders can be refunded"
        );
    }

    // Resolve Stripe transaction identifier

    const customerRefundAmount = order.totalPrice;
    let vendorCharge = 0;
    let vendorProfit = 0;
    const userRole = isUser.role;

    // Refund Rules based on initiator role:
    if (userRole === USER_ROLE.ADMIN || userRole === USER_ROLE.SUPER_ADMIN) {
        // 1. Admin-initiated refund:
        // Customer receives full refund, vendor is not charged any additional fee or commission.
        vendorCharge = 0;
        vendorProfit = 0;
    } else if (userRole === USER_ROLE.CUSTOMER) {
        // 2. Customer-initiated refund before shipping:
        const customerId = (order.customer as any)?._id?.toString() || order.customer?.toString();
        if (customerId !== isUser._id.toString()) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to refund this order");
        }

        const isShipped =
            [ORDER_STATUS.SHIPPED, ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.DELIVERED, ORDER_STATUS.OUT_OF_DELIVERY].includes(
                order.status as any
            ) || Boolean(order.tracking?.shippedAt);

        if (isShipped) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                "Customer cannot request a refund after the order has been shipped. Please submit a dispute request."
            );
        }

        // Customer receives full refund, vendor is not charged any additional fee or commission.
        vendorCharge = 0;
        vendorProfit = 0;
    } else if (userRole === USER_ROLE.VENDOR) {
        // 3. Vendor-initiated refund:
        const vendorId = (order.vendor as any)?._id?.toString() || order.vendor?.toString();
        let isAuthorizedVendor = vendorId === isUser._id.toString();

        if (!isAuthorizedVendor) {
            const vendorDoc = await Vendor.findOne({ user: isUser._id });
            if (vendorDoc && (vendorId === vendorDoc._id.toString() || vendorId === vendorDoc.user?.toString())) {
                isAuthorizedVendor = true;
            }
        }

        if (!isAuthorizedVendor) {
            throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to refund this order");
        }

        // 5% charge of the order's total price deducted from vendor's profit/vendor amount
        vendorCharge = +(order.totalPrice * 0.05).toFixed(2);
        vendorProfit = -vendorCharge;
    } else {
        throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to refund this order");
    }

    // Trigger Stripe Refund Process
    let stripeRefund: Stripe.Refund;
    try {
        const refundParams: Stripe.RefundCreateParams = {
            amount: Math.round(customerRefundAmount * 100), // Stripe expects cents
            reason: "requested_by_customer",
            metadata: {
                orderId: order._id.toString(),
                orderNo: order.orderNo,
                refundInitiatorRole: userRole,
                refundInitiatorId: isUser._id.toString(),
                vendorCharge: vendorCharge.toString(),
                vendorProfit: vendorProfit.toString(),
                customerRefundAmount: customerRefundAmount.toString(),
            },
        };

        stripeRefund = await stripe.refunds.create(refundParams);
    } catch (stripeErr: any) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Stripe refund failed: ${stripeErr.message || "Payment gateway rejected refund"}`
        );
    }

    // Database update in an atomic transaction
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    let updatedOrder: TOrder | null = null;
    try {
        updatedOrder = await Order.findByIdAndUpdate(
            order._id,
            {
                $set: {
                    status: ORDER_STATUS.REFUNDED,
                    paymentStatus: PAYMENT_STATUS.REFUNDED,
                    vendorAmount: vendorProfit,
                    refund: {
                        refundId: stripeRefund.id,
                        refundAmount: customerRefundAmount,
                        vendorCharge,
                        vendorProfit,
                        refundedBy: isUser._id,
                        refundInitiatorRole: userRole,
                        refundReason: `Refund initiated by ${userRole}`,
                        refundedAt: new Date(),
                        stripeRefundStatus: stripeRefund.status,
                    },
                },
            },
            { session: dbSession, new: true }
        );

        await Payment.findOneAndUpdate(
            { $or: [{ orderId: order._id }] },
            {
                $set: {
                    status: PAYMENT_STATUS.REFUNDED,
                    stripeEventId: stripeRefund.id,
                    paymentGatewayData: {
                        refundId: stripeRefund.id,
                        refundAmount: customerRefundAmount,
                        vendorCharge,
                        vendorProfit,
                        refundInitiatorRole: userRole,
                        refundedBy: isUser._id,
                        stripeRefund,
                    },
                },
            },
            { session: dbSession, upsert: true }
        );

        // Restore inventory if order was unshipped
        const wasUnshipped = [ORDER_STATUS.PENDING, ORDER_STATUS.UNSHIPPED].includes(order.status as any);
        if (wasUnshipped && order.products && order.products.length > 0) {
            for (const item of order.products) {
                await Inventory.findOneAndUpdate(
                    {
                        variant: item.variant,
                        "seller.vendor": order.vendor,
                    },
                    {
                        $inc: { "seller.quantity": item.quantity },
                        $set: { "seller.isStock": true },
                    },
                    { session: dbSession }
                );
            }
        }

        await dbSession.commitTransaction();
        dbSession.endSession();
    } catch (dbErr) {
        await dbSession.abortTransaction();
        dbSession.endSession();
        throw dbErr;
    }

    // Trigger post-order background operations
    try {
        await triggerPostOrderOperations(order._id.toString());
    } catch (opErr) {
        console.error(`[Order Refund] Post-order operations error:`, opErr);
    }

    // Real-time and persistent notifications
    try {
        const customerIdStr = (order.customer as any)?._id?.toString() || order.customer?.toString();
        emitNotification(`customer:${customerIdStr}`, "payment_refunded", {
            orderId: order._id,
            orderNo: order.orderNo,
            refundAmount: customerRefundAmount,
            message: `Your payment of $${customerRefundAmount} for order #${order.orderNo} has been refunded via Stripe.`,
        });

        await NotificationServices.createNotificationIntoDB({
            recipientRole: USER_ROLE.CUSTOMER,
            recipientId: customerIdStr,
            type: "ORDER_CANCELLED" as any,
            message: `Your order #${order.orderNo} has been refunded in full ($${customerRefundAmount}).`,
            relatedId: order._id,
        });
    } catch (notifErr) {
        console.error(`[Order Refund] Customer notification error:`, notifErr);
    }

    try {
        const vendorIdStr = (order.vendor as any)?._id?.toString() || order.vendor?.toString();
        const vendorMsg =
            userRole === USER_ROLE.VENDOR
                ? `Order #${order.orderNo} was refunded by you. A 5% penalty fee ($${vendorCharge}) was deducted from your vendor earnings.`
                : `Order #${order.orderNo} has been refunded ($${customerRefundAmount}). No penalty fee was charged to your account.`;

        emitNotification(`vendor:${vendorIdStr}`, "order_refunded", {
            orderId: order._id,
            orderNo: order.orderNo,
            vendorCharge,
            vendorProfit,
            message: vendorMsg,
        });

        await NotificationServices.createNotificationIntoDB({
            recipientRole: USER_ROLE.VENDOR,
            recipientId: vendorIdStr,
            type: "ORDER_CANCELLED" as any,
            message: vendorMsg,
            relatedId: order._id,
        });
    } catch (notifErr) {
        console.error(`[Order Refund] Vendor notification error:`, notifErr);
    }

    return {
        order: updatedOrder,
        refund: {
            refundId: stripeRefund.id,
            refundAmount: customerRefundAmount,
            vendorCharge,
            vendorProfit,
            refundInitiatorRole: userRole,
            stripeStatus: stripeRefund.status,
        },
    };
};


const scheduleOrderStatusUpdates = async () => {
    const ordersToUpdate = await Order.find({
        status: {
            $in: [
                ORDER_STATUS.SHIPPED,
                ORDER_STATUS.IN_TRANSIT,
                ORDER_STATUS.OUT_OF_DELIVERY,
            ],
        },
        "tracking.shippedAt": { $exists: true, $ne: null },
        isDeleted: { $ne: true },
    });

    let updatedCount = 0;
    const now = Date.now();

    for (const order of ordersToUpdate) {
        if (!order.tracking?.shippedAt) continue;

        const shippedAtMs = new Date(order.tracking.shippedAt).getTime();
        const diffDays = (now - shippedAtMs) / (1000 * 60 * 60 * 24);

        let newStatus: string | null = null;
        let isDelivered = false;

        // Progression timeline:
        // 5 days after tracking assigned -> DELIVERED
        // 4 days after tracking assigned -> OUT_OF_DELIVERY
        // 2 days after tracking assigned -> IN_TRANSIT
        if (diffDays >= 5) {
            if (order.status !== ORDER_STATUS.DELIVERED) {
                newStatus = ORDER_STATUS.DELIVERED;
                isDelivered = true;
            }
        } else if (diffDays >= 4) {
            if (order.status !== ORDER_STATUS.OUT_OF_DELIVERY) {
                newStatus = ORDER_STATUS.OUT_OF_DELIVERY;
            }
        } else if (diffDays >= 2) {
            if (order.status === ORDER_STATUS.SHIPPED) {
                newStatus = ORDER_STATUS.IN_TRANSIT;
            }
        }

        if (newStatus && newStatus !== order.status) {
            const updateDoc: Record<string, any> = {
                status: newStatus,
            };

            if (isDelivered && !order.tracking.deliveredAt) {
                updateDoc["tracking.deliveredAt"] = new Date();
            }

            await Order.findByIdAndUpdate(order._id, { $set: updateDoc });
            updatedCount++;

            if (isDelivered) {
                try {
                    await triggerPostOrderOperations(order._id.toString());
                } catch (err) {
                    console.error(`[Order Status Cron] Error in post-order operations for order ${order._id}:`, err);
                }
            }

            try {
                const customerIdStr = (order.customer as any)?._id?.toString() || order.customer?.toString();
                emitNotification(`customer:${customerIdStr}`, "order_status_updated", {
                    orderId: order._id,
                    orderNo: order.orderNo,
                    status: newStatus,
                    message: `Your order #${order.orderNo} is now ${newStatus.replace(/_/g, " ")}.`,
                });

                await NotificationServices.createNotificationIntoDB({
                    recipientRole: USER_ROLE.CUSTOMER,
                    recipientId: order.customer,
                    type: "ORDER_SHIPPED" as any,
                    message: `Status update: Your order #${order.orderNo} is now ${newStatus.replace(/_/g, " ")}.`,
                    relatedId: order._id,
                });
            } catch (sockErr) {
                console.error(`[Order Status Cron] Notification error:`, sockErr);
            }
        }
    }

    return { updatedCount };
};

export const OrderServices = {
    createOrderIntoDB,
    getAllOrdersFromDB,
    allOrdersByUserFromDB,
    getSingleOrderFromDB,
    triggerPostOrderOperations,
    cancelExpiredUnpaidOrders,
    updateOrderInDB,
    orderRefundFromDB,
    scheduleOrderStatusUpdates,
};