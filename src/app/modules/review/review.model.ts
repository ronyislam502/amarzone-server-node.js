import { model, Schema } from "mongoose";
import { TProductReview, TShopReview } from "./review.interface";

const ProductReviewSchema = new Schema<TProductReview>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Customer",
    },
    order: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    product: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: "Order",
    },
    comment: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ShopReviewSchema = new Schema<TShopReview>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Customer",
    },
    order: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Order",
    },
    shop: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Shop",
    },
    feedback: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ProductReview = model<TProductReview>(
  "ProductReview",
  ProductReviewSchema
);

export const ShopReview = model<TShopReview>("ShopReview", ShopReviewSchema);
