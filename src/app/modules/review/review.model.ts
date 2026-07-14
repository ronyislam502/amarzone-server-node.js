import { model, Schema } from "mongoose";
import { TServiceReview } from "./review.interface";

const serviceReviewSchema = new Schema<TServiceReview>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vendor is required"],
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    title: {
      type: String,
      trim: true,
    },
    review: {
      type: String,
      required: [true, "Review description is required"],
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

serviceReviewSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

serviceReviewSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

serviceReviewSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

export const ServiceReview = model<TServiceReview>("ServiceReview", serviceReviewSchema);
