import Stripe from "stripe";
import config from "../../config";
import { Order } from "../order/order.model";
import { Payment } from "./payment.model";
import { stripe } from "../../utilities/stripe";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { PAYMENT_STATUS } from "../../interface/common";

const stripeWebhook = async (rawBody: Buffer, signature: string) => {
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature,
            config.stripe_webhook_secret as string
        );
    } catch (err: any) {
        throw new AppError(httpStatus.BAD_REQUEST, `Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.orderId;

        if (orderId) {
            // Update the Order status
            const order = await Order.findByIdAndUpdate(
                orderId,
                {
                    paymentStatus: PAYMENT_STATUS.PAID,
                    transactionId: paymentIntent.id,
                },
                { new: true }
            );

            if (order) {
                // Create a Payment record
                await Payment.create({
                    orderId: order._id,
                    transactionId: paymentIntent.id,
                    amount: paymentIntent.amount / 100, // Convert cents back to dollars if amount was stored in dollars
                    currency: paymentIntent.currency,
                    status: PAYMENT_STATUS.PAID,
                    stripeEventId: event.id,
                    paymentGatewayData: paymentIntent,
                });
            }
        }
    }

    return true;
};

export const PaymentServices = {
    stripeWebhook,
};
