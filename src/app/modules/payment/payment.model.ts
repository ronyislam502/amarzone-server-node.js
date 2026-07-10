import { Schema, model } from "mongoose";
import { IProcessedEvent, TPayment } from "./payment.interface";
import { PAYMENT_STATUS } from "../../interface/common";

const paymentSchema = new Schema<TPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "usd",
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
      required: true,
    },
    receiptUrl: {
      type: String,
      trim: true,
    },
    stripeEventId: {
      type: String,
      trim: true,
    },
    paymentGatewayData: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);




const processedEventSchema = new Schema<IProcessedEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: "7d", // TTL index to automatically clean up processed events after 7 days
    },
  }
);

export const ProcessedEvent = model<IProcessedEvent>("ProcessedEvent", processedEventSchema);

export const Payment = model<TPayment>("Payment", paymentSchema);
