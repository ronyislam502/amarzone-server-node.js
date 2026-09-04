import { Schema, model } from "mongoose";
import { IAccountHealth } from "./health.interface";
import { VENDOR_HEALTH } from "../../interface/common";

const accountHealthSchema = new Schema<IAccountHealth>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    orderDefectRate: {
      type: Number,
      required: true,
      default: 0,
    },
    lateShipmentRate: {
      type: Number,
      required: true,
      default: 0,
    },
    cancellationRate: {
      type: Number,
      required: true,
      default: 0,
    },
    validTrackingRate: {
      type: Number,
      required: true,
      default: 100,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 1000,
      default: 1000,
    },
    status: {
      type: String,
      enum: Object.keys(VENDOR_HEALTH),
      default: VENDOR_HEALTH.HEALTHY,
      required: true,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AccountHealth = model<IAccountHealth>("AccountHealth", accountHealthSchema);
