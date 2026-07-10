import Stripe from "stripe";
import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import config from "../../config";
import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { InventoryProduct } from "../inventory/inventory.model";
import { JwtPayload } from "jsonwebtoken";
import { Payment, ProcessedEvent } from "./payment.model";
import { invoiceQueue } from "../../queues/invoice.queue";
import { emitNotification } from "../../socket/socket";
import mongoose from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

const stripe = new Stripe(config.stripe_secret_key as string, {
  apiVersion: "2023-10-02" as any,
});

const createCheckoutSession = async (user: JwtPayload, payload: { orderId: string }) => {
  const isUserExists = await User.isUserExistsByEmail(user.email);
  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const order = await Order.findById(payload.orderId);
  if (!order) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  if (order.customer.toString() !== isUserExists._id?.toString()) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "You are not authorized to pay for this order"
    );
  }

  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw new AppError(httpStatus.BAD_REQUEST, "Order is already paid");
  }

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: order._id.toString(),
    success_url: `http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `http://localhost:5173/payment/cancel`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Order #${order.orderNo}`,
            description: `Payment for order ${order.orderNo}`,
          },
          unit_amount: Math.round(order.grandAmount * 100), // Stripe expects cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId: order._id.toString(),
    },
    payment_intent_data: {
      metadata: {
        orderId: order._id.toString(),
      },
    },
  });

  return { checkoutUrl: session.url };
};

const processWebhook = async (rawBody: Buffer, signature: string, secret: string) => {
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

  console.log(`[Webhook Service] Processing Stripe Event: ${event.type} (${event.id})`);

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
              transactionId: transactionId,
            },
          },
          { session: dbSession, new: true }
        );

        if (!updatedOrder) {
          throw new Error(`Order not found: ${orderId}`);
        }

        // Create or update Payment using the local database order grandAmount instead of Stripe amount_total
        await Payment.findOneAndUpdate(
          { transactionId },
          {
            $set: {
              orderId: new mongoose.Types.ObjectId(orderId),
              amount: updatedOrder.grandAmount,
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

        // Emit notifications via Socket.IO (wrapped in try/catch to isolate errors)
        try {
          emitNotification(`customer:${updatedOrder.customer}`, "payment_success", {
            orderId,
            orderNo: updatedOrder.orderNo,
            amount: updatedOrder.grandAmount,
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
          { transactionId },
          {
            $set: {
              orderId: new mongoose.Types.ObjectId(orderId),
              amount: orderData.grandAmount,
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
          await InventoryProduct.findOneAndUpdate(
            {
              product: item.product,
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

        // Emit notification via Socket.IO (wrapped in try/catch to isolate errors)
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
      const transactionId = charge.payment_intent as string || charge.id;

      if (!orderId && charge.payment_intent) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          charge.payment_intent as string
        );
        orderId = paymentIntent.metadata?.orderId;
      }

      if (!orderId) {
        console.warn("[Webhook Service] charge.refunded received without orderId mapping.");
        break;
      }

      const dbSession = await mongoose.startSession();
      dbSession.startTransaction();

      try {
        // Update Order
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            $set: {
              paymentStatus: PAYMENT_STATUS.REFUNDED,
              status: ORDER_STATUS.REFUNDED,
            },
          },
          { session: dbSession, new: true }
        );

        // Update Payment status to REFUNDED
        await Payment.findOneAndUpdate(
          { transactionId },
          {
            $set: {
              status: PAYMENT_STATUS.REFUNDED,
              stripeEventId: event.id,
              paymentGatewayData: charge,
            },
          },
          { session: dbSession }
        );

        // Store the Processed Stripe Event inside the same MongoDB transaction
        await ProcessedEvent.create([{ eventId: event.id }], { session: dbSession });

        await dbSession.commitTransaction();
        dbSession.endSession();

        if (updatedOrder) {
          // Emit notification via Socket.IO (wrapped in try/catch to isolate errors)
          try {
            emitNotification(`customer:${updatedOrder.customer}`, "payment_refunded", {
              orderId,
              orderNo: updatedOrder.orderNo,
              message: "Your order payment has been refunded.",
            });
          } catch (socketError) {
            console.error(`[Webhook Service] Socket notification failed for customer:`, socketError);
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
  createCheckoutSession,
  processWebhook,
};
