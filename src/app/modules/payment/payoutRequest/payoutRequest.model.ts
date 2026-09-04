import { Schema, model } from "mongoose";
import { TPayoutRequest } from "./payoutRequest.interface";

const payoutRequestSchema = new Schema<TPayoutRequest>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    bankDetails: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const PayoutRequest = model<TPayoutRequest>("PayoutRequest", payoutRequestSchema);
