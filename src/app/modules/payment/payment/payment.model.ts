import { Schema, model } from "mongoose";
import { TPayment } from "./payment.interface";
import { PAYMENT_STATUS } from "../../../interface/common";

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
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Payment = model<TPayment>("Payment", paymentSchema);
