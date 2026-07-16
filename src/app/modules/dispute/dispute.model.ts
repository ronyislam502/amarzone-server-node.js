import { Schema, model } from "mongoose";
import { DISPUTE_STATUS, TDispute } from "./dispute.interface";

const disputeSchema = new Schema<TDispute>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
    },
    details: {
      type: String,
      required: [true, "Details are required"],
      trim: true,
    },
    evidenceUrls: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.keys(DISPUTE_STATUS),
      default: DISPUTE_STATUS.OPEN,
      required: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const Dispute = model<TDispute>("Dispute", disputeSchema);
