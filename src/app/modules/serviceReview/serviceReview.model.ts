import { model, Schema } from "mongoose";
import { TServiceReview } from "./serviceReview.interface";

const serviceReviewSchema = new Schema<TServiceReview>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      required: [true, "Customer is required"],
      ref: "User",
    },
    vendor: {
      type: Schema.Types.ObjectId,
      required: [true, "Vendor is required"],
      ref: "User",
    },
    order: {
      type: Schema.Types.ObjectId,
      required: [true, "Order is required"],
      ref: "Order",
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
    },
    title: {
      type: String,
    },
    review: {
      type: String,
      required: [true, "Review is required"],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const ServiceReview = model<TServiceReview>("ServiceReview", serviceReviewSchema);
