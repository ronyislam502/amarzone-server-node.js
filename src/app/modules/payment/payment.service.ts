import Stripe from "stripe";
import { stripe } from "../../utilities/stripe";
import { ProcessedEvent } from "../processedEvent/processedEvent.model";
import mongoose from "mongoose";
import { Order } from "../order/order.model";
import { ORDER_STATUS, PAYMENT_STATUS, USER_ROLE } from "../../interface/common";
import { Payment } from "./payment.model";
import { OrderServices } from "../order/order.service";
import { emitNotification } from "../../socket/socket";
import { invoiceQueue } from "../../redis/invoice.queue";
import { Inventory } from "../inventory/inventory.model";


const stripeWebhookPayment = async (rawBody: Buffer, signature: string, secret: string) => {
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            rawBody.toString(),
            signature,
            secret
        );
    } catch (err: any) {
        throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    // Idempotency check: check if the event was already processed
    const existingEvent = await ProcessedEvent.findOne({ eventId: event.id });
    if (existingEvent) {
        console.log(`[Webhook Service] Duplicate event detected and ignored: ${event.id}`);
        return;
    }

    // console.log(`[Webhook Service] Processing Stripe Event: ${event.type} (${event.id})`);

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId || session.client_reference_id;

            if (!orderId) {
                console.warn("[Webhook Service] checkout.session.completed received without orderId in metadata.");
                break;
            }

            const isPaid = session.payment_status === "paid";
            const transactionId = (session.payment_intent as string) || session.id;

            const dbSession = await mongoose.startSession();
            dbSession.startTransaction();

            try {
                // Update Order
                const updatedOrder = await Order.findByIdAndUpdate(
                    orderId,
                    {
                        $set: {
                            paymentStatus: isPaid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
                            ...(isPaid && { status: ORDER_STATUS.UNSHIPPED }),
                        },
                    },
                    { session: dbSession, new: true }
                );

                if (!updatedOrder) {
                    throw new Error(`Order not found: ${orderId}`);
                }

                // Create or update Payment using the local database order grandAmount instead of Stripe amount_total
                await Payment.findOneAndUpdate(
                    { orderId: new mongoose.Types.ObjectId(orderId) },
                    {
                        $set: {
                            orderId: new mongoose.Types.ObjectId(orderId),
                            transactionId: transactionId,
                            amount: updatedOrder.totalPrice,
                            currency: session.currency || "usd",
                            status: isPaid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
                            stripeEventId: event.id,
                            paymentGatewayData: session,
                        },
                    },
                    { session: dbSession, upsert: true, new: true }
                );

                // Store the Processed Stripe Event inside the same MongoDB transaction
                await ProcessedEvent.create([{ eventId: event.id }], { session: dbSession });

                await dbSession.commitTransaction();
                dbSession.endSession();

                // Explicitly trigger post order operations
                try {
                    await OrderServices.triggerPostOrderOperations(orderId.toString());
                } catch (opError) {
                    console.error("[Webhook Service] Failed to trigger post-order operations:", opError);
                }

                // // Emit notifications via Socket.IO (wrapped in try/catch to isolate errors)
                try {
                    emitNotification(`customer:${updatedOrder.customer}`, "payment_success", {
                        orderId,
                        orderNo: updatedOrder.orderNo,
                        amount: updatedOrder.totalPrice,
                        message: "Your payment was processed successfully!",
                    });
                } catch (socketError) {
                    console.error(`[Webhook Service] Socket notification failed for customer:`, socketError);
                }

                try {
                    emitNotification(`vendor:${updatedOrder.vendor}`, "new_order", {
                        orderId,
                        orderNo: updatedOrder.orderNo,
                        message: "You have a new paid order!",
                    });
                } catch (socketError) {
                    console.error(`[Webhook Service] Socket notification failed for vendor:`, socketError);
                }

                // Add job to BullMQ with unique jobId to prevent duplicate invoice generation
                if (isPaid) {
                    await invoiceQueue.add("processInvoice", { orderId }, { jobId: orderId });
                    console.log(`[Webhook Service] Enqueued post-payment background job with jobId: ${orderId}`);
                }

            } catch (error) {
                await dbSession.abortTransaction();
                dbSession.endSession();
                throw error;
            }
            break;
        }

        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            if (!orderId) {
                console.warn("[Webhook Service] payment_intent.succeeded received without orderId in metadata.");
                break;
            }

            const isPaid = paymentIntent.status === "succeeded";
            const transactionId = paymentIntent.id;

            const dbSession = await mongoose.startSession();
            dbSession.startTransaction();

            try {
                // Update Order
                const updatedOrder = await Order.findByIdAndUpdate(
                    orderId,
                    {
                        $set: {
                            paymentStatus: isPaid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
                            ...(isPaid && { status: ORDER_STATUS.UNSHIPPED }),
                        },
                    },
                    { session: dbSession, new: true }
                );

                if (!updatedOrder) {
                    throw new Error(`Order not found: ${orderId}`);
                }

                // Create or update Payment using the local database order grandAmount
                await Payment.findOneAndUpdate(
                    { orderId: new mongoose.Types.ObjectId(orderId) },
                    {
                        $set: {
                            orderId: new mongoose.Types.ObjectId(orderId),
                            transactionId: transactionId,
                            amount: updatedOrder.totalPrice,
                            currency: paymentIntent.currency || "usd",
                            status: isPaid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
                            stripeEventId: event.id,
                            paymentGatewayData: paymentIntent,
                        },
                    },
                    { session: dbSession, upsert: true, new: true }
                );

                // Store the Processed Stripe Event inside the same MongoDB transaction
                // await ProcessedEvent.create([{ eventId: event.id }], { session: dbSession });

                await dbSession.commitTransaction();
                dbSession.endSession();

                // Explicitly trigger post order operations
                try {
                    await OrderServices.triggerPostOrderOperations(orderId.toString());
                } catch (opError) {
                    console.error("[Webhook Service] Failed to trigger post-order operations:", opError);
                }

                // Emit notifications via Socket.IO
                try {
                    emitNotification(`customer:${updatedOrder.customer}`, "payment_success", {
                        orderId,
                        orderNo: updatedOrder.orderNo,
                        amount: updatedOrder.totalPrice,
                        message: "Your payment was processed successfully!",
                    });
                } catch (socketError) {
                    console.error(`[Webhook Service] Socket notification failed for customer:`, socketError);
                }

                try {
                    emitNotification(`vendor:${updatedOrder.vendor}`, "new_order", {
                        orderId,
                        orderNo: updatedOrder.orderNo,
                        message: "You have a new paid order!",
                    });
                } catch (socketError) {
                    console.error(`[Webhook Service] Socket notification failed for vendor:`, socketError);
                }

                // Add job to BullMQ
                if (isPaid) {
                    await invoiceQueue.add("processInvoice", { orderId }, { jobId: orderId });
                    console.log(`[Webhook Service] Enqueued post-payment background job with jobId: ${orderId}`);
                }

            } catch (error) {
                await dbSession.abortTransaction();
                dbSession.endSession();
                throw error;
            }
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const orderId = paymentIntent.metadata?.orderId;

            if (!orderId) {
                console.warn("[Webhook Service] payment_intent.payment_failed received without orderId in metadata.");
                break;
            }

            const orderData = await Order.findById(orderId);
            if (!orderData) {
                console.warn(`[Webhook Service] Order not found for failed payment: ${orderId}`);
                break;
            }

            const transactionId = paymentIntent.id;

            const dbSession = await mongoose.startSession();
            dbSession.startTransaction();

            try {
                // Cancel order
                await Order.findByIdAndUpdate(
                    orderId,
                    {
                        $set: {
                            paymentStatus: PAYMENT_STATUS.UNPAID,
                            status: ORDER_STATUS.CANCELLED,
                        },
                    },
                    { session: dbSession }
                );

                // Update Payment to FAILED using the database order grandAmount
                await Payment.findOneAndUpdate(
                    { orderId: new mongoose.Types.ObjectId(orderId) },
                    {
                        $set: {
                            orderId: new mongoose.Types.ObjectId(orderId),
                            transactionId: transactionId,
                            amount: orderData.totalPrice,
                            currency: paymentIntent.currency || "usd",
                            status: PAYMENT_STATUS.UNPAID,
                            stripeEventId: event.id,
                            paymentGatewayData: paymentIntent,
                        },
                    },
                    { session: dbSession, upsert: true }
                );

                // Restore inventory
                for (const item of orderData.products) {
                    await Inventory.findOneAndUpdate(
                        {
                            product: item.variant,
                            "seller.vendor": orderData.vendor,
                        },
                        {
                            $inc: { "seller.quantity": item.quantity },
                            $set: { "seller.isStock": true },
                        },
                        { session: dbSession }
                    );
                }

                // Store the Processed Stripe Event inside the same MongoDB transaction
                await ProcessedEvent.create([{ eventId: event.id }], { session: dbSession });

                await dbSession.commitTransaction();
                dbSession.endSession();

                // Explicitly trigger post order operations
                try {
                    await OrderServices.triggerPostOrderOperations(orderId.toString());
                } catch (opError) {
                    console.error("[Webhook Service] Failed to trigger post-order operations:", opError);
                }

                // // Emit notification via Socket.IO (wrapped in try/catch to isolate errors)
                try {
                    emitNotification(`customer:${orderData.customer}`, "payment_failed", {
                        orderId,
                        orderNo: orderData.orderNo,
                        message: "Your payment failed. The order has been cancelled and stock released.",
                    });
                } catch (socketError) {
                    console.error(`[Webhook Service] Socket notification failed for customer:`, socketError);
                }

            } catch (error) {
                await dbSession.abortTransaction();
                dbSession.endSession();
                throw error;
            }
            break;
        }

        case "charge.refunded": {
            const charge = event.data.object as Stripe.Charge;
            let orderId = charge.metadata?.orderId;
            const transactionId = (charge.payment_intent as string) || charge.id;

            if (!orderId && charge.payment_intent) {
                try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(
                        charge.payment_intent as string
                    );
                    orderId = paymentIntent.metadata?.orderId;
                } catch (err) {
                    console.warn("[Webhook Service] Failed to retrieve payment intent for charge.refunded:", err);
                }
            }

            // Fallback resolution if orderId is missing from charge/intent metadata
            if (!orderId) {
                const foundPayment = await Payment.findOne({
                    $or: [
                        { transactionId },
                        { "paymentGatewayData.id": charge.id },
                        { "paymentGatewayData.payment_intent": charge.payment_intent },
                    ],
                });

                if (foundPayment?.orderId) {
                    orderId = foundPayment.orderId.toString();
                } else {
                    const foundOrder = await Order.findOne({
                        "refund.refundId": charge.id,
                    });
                    if (foundOrder) {
                        orderId = foundOrder._id.toString();
                    }
                }
            }

            if (!orderId) {
                console.warn("[Webhook Service] charge.refunded received without orderId mapping.");
                break;
            }

            const existingOrder = await Order.findById(orderId);
            if (!existingOrder) {
                console.warn(`[Webhook Service] Order not found for charge.refunded: ${orderId}`);
                break;
            }

            const latestRefund = charge.refunds?.data?.[0];
            const initiatorRole = latestRefund?.metadata?.refundInitiatorRole || "ADMIN";
            let vendorCharge = 0;
            let vendorProfit = 0;

            if (latestRefund?.metadata?.vendorCharge) {
                vendorCharge = parseFloat(latestRefund.metadata.vendorCharge);
            }
            if (latestRefund?.metadata?.vendorProfit) {
                vendorProfit = parseFloat(latestRefund.metadata.vendorProfit);
            } else if (initiatorRole === USER_ROLE.VENDOR) {
                vendorCharge = +(existingOrder.totalPrice * 0.05).toFixed(2);
                vendorProfit = -vendorCharge;
            }

            const dbSession = await mongoose.startSession();
            dbSession.startTransaction();

            try {
                const updateQuery: Record<string, any> = {
                    paymentStatus: PAYMENT_STATUS.REFUNDED,
                    status: ORDER_STATUS.REFUNDED,
                };

                // If refund subdocument was not already set, populate it
                if (!existingOrder.refund) {
                    updateQuery.vendorAmount = vendorProfit;
                    updateQuery.refund = {
                        refundId: latestRefund?.id || charge.id,
                        refundAmount: (charge.amount_refunded || charge.amount) / 100,
                        vendorCharge,
                        vendorProfit,
                        refundedBy: latestRefund?.metadata?.refundInitiatorId || existingOrder.customer,
                        refundInitiatorRole: initiatorRole,
                        refundReason: "Refund processed via Stripe",
                        refundedAt: new Date(),
                        stripeRefundStatus: latestRefund?.status || "succeeded",
                    };
                }

                // Update Order
                const updatedOrder = await Order.findByIdAndUpdate(
                    orderId,
                    { $set: updateQuery },
                    { session: dbSession, new: true }
                );

                // Update Payment status to REFUNDED
                await Payment.findOneAndUpdate(
                    { transactionId },
                    {
                        $set: {
                            status: PAYMENT_STATUS.REFUNDED,
                            stripeEventId: event.id,
                            paymentGatewayData: {
                                charge,
                                refund: latestRefund,
                                vendorCharge,
                                vendorProfit,
                            },
                        },
                    },
                    { session: dbSession, upsert: true }
                );

                // Restore inventory if order was unshipped and not already refunded
                const wasUnshipped = [ORDER_STATUS.PENDING, ORDER_STATUS.UNSHIPPED].includes(existingOrder.status as any);
                if (wasUnshipped && existingOrder.products && existingOrder.products.length > 0 && !existingOrder.refund) {
                    for (const item of existingOrder.products) {
                        await Inventory.findOneAndUpdate(
                            {
                                variant: item.variant,
                                "seller.vendor": existingOrder.vendor,
                            },
                            {
                                $inc: { "seller.quantity": item.quantity },
                                $set: { "seller.isStock": true },
                            },
                            { session: dbSession }
                        );
                    }
                }

                // Store the Processed Stripe Event inside the same MongoDB transaction
                await ProcessedEvent.create([{ eventId: event.id }], { session: dbSession });

                await dbSession.commitTransaction();
                dbSession.endSession();

                // Explicitly trigger post order operations
                try {
                    await OrderServices.triggerPostOrderOperations(orderId.toString());
                } catch (opError) {
                    console.error("[Webhook Service] Failed to trigger post-order operations:", opError);
                }

                if (updatedOrder) {
                    // Emit notification via Socket.IO
                    try {
                        emitNotification(`customer:${updatedOrder.customer}`, "payment_refunded", {
                            orderId,
                            orderNo: updatedOrder.orderNo,
                            refundAmount: updatedOrder.refund?.refundAmount || updatedOrder.totalPrice,
                            message: "Your order payment has been refunded.",
                        });
                    } catch (socketError) {
                        console.error(`[Webhook Service] Socket notification failed for customer:`, socketError);
                    }

                    try {
                        emitNotification(`vendor:${updatedOrder.vendor}`, "order_refunded", {
                            orderId,
                            orderNo: updatedOrder.orderNo,
                            vendorCharge,
                            vendorProfit,
                            message: `Order #${updatedOrder.orderNo} has been refunded.`,
                        });
                    } catch (socketError) {
                        console.error(`[Webhook Service] Socket notification failed for vendor:`, socketError);
                    }
                }

            } catch (error) {
                await dbSession.abortTransaction();
                dbSession.endSession();
                throw error;
            }
            break;
        }

        default:
            console.log(`[Webhook Service] Unhandled event type: ${event.type}`);
            break;
    }

    console.log(`[Webhook Service] Event ${event.id} marked as successfully processed.`);
};


export const PaymentServices = {
    stripeWebhookPayment
};
