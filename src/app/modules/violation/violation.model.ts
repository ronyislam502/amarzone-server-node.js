import { Schema, model } from "mongoose";
import { IViolation } from "./violation.interface";
import { SLA_SEVERITY } from "../../interface/common";

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
      enum: Object.values(SLA_SEVERITY),
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

export const SlaViolation = model<IViolation>("SlaViolation", violationSchema);
