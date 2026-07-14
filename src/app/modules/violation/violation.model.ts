import { Schema, model } from "mongoose";
import { IViolation } from "./violation.interface";

const violationSchema = new Schema<IViolation>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metric: {
      type: String,
      required: true,
    },
    actualValue: {
      type: Number,
      required: true,
    },
    severity: {
      type: String,
      enum: ["Warning", "Suspension"],
      required: true,
    },
    isResolved: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick lookup of unresolved violations by vendor and metric
violationSchema.index({ vendor: 1, metric: 1, isResolved: 1 });

export const SlaViolation = model<IViolation>("SlaViolation", violationSchema);
