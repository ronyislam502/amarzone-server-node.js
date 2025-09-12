import { model, Schema } from "mongoose";
import { TSeller, TShopProduct } from "./shopProduct.interface";

const SellerSchema = new Schema<TSeller>({
  shop: {
    type: Schema.Types.ObjectId,
    ref: "Shop",
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  isStock: {
    type: Boolean,
    default: true,
  },
  shippingTime: {
    type: Number,
    required: true,
  },
  deliveryTime: {
    type: Number,
  },
  isBuyBoxWinner: {
    type: Boolean,
    default: false,
  },
});

const ShopProductSchema = new Schema<TShopProduct>(
  {
    product: {
      type: Schema.Types.ObjectId,
      required: [true, "product id is required"],
      ref: "Product",
    },
    asin: {
      type: String,
      required: [true, "ASIN is required"],
    },
    seller: {
      type: SellerSchema,
      required: [true, "Seller is required"],
    },
  },
  { timestamps: true }
);

ShopProductSchema.pre("find", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

ShopProductSchema.pre("findOne", function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

ShopProductSchema.pre("aggregate", function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

export const ShopProduct = model<TShopProduct>(
  "ShopProduct",
  ShopProductSchema
);
