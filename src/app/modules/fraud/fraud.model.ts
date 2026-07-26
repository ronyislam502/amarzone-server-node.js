import { Schema, model } from "mongoose";
import { IFraud } from "./fraud.interface";
import { FRAUD_STATUS } from "../../interface/common";

const fraudSchema = new Schema<IFraud>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    score: {
      type: Number,
      required: [true, "Fraud score is required"],
      min: 0,
      max: 100,
      default: 0,
    },
    reasons: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(FRAUD_STATUS),
      default: FRAUD_STATUS.SAFE,
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


export const Fraud = model<IFraud>("Fraud", fraudSchema);

