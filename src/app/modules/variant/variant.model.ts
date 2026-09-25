import { Schema, model } from "mongoose";
import { TVariantAttribute, TVariant } from "./variant.interface";

const variantAttributeSchema = new Schema<TVariantAttribute>(
  {
    type: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const variantSchema = new Schema<TVariant>(
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
    inventories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Inventory",
      },
    ],
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

export const Variant = model<TVariant>("Variant", variantSchema);
