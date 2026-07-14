import { model, Schema } from "mongoose";
import { TProductReview } from "./productReview.interface";

const productReviewSchema = new Schema<TProductReview>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);


// Query Middlewares to exclude deleted reviews
productReviewSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

productReviewSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

productReviewSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});




export const ProductReview = model<TProductReview>("ProductReview", productReviewSchema);
