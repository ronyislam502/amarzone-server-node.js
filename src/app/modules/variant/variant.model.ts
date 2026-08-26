import { Schema, model } from "mongoose";
import { TVariantAttribute, TVariants } from "./variant.interface";

const variantAttributeSchema = new Schema<TVariantAttribute>(
  {
    type: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const variantSchema = new Schema<TVariants>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    asin: {
      type: String,
      required: true
    },
    sku: {
      type: String,
      required: true
    },
    attributes: {
      type: [variantAttributeSchema],
      required: true
    },
    images: [{
      type: String,
      default: ""
    }],
    isPrivateLevel: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
  },
  {
    timestamps: true,
  }
);

variantSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

variantSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

variantSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

export const Variant = model<TVariants>("Variant", variantSchema);
