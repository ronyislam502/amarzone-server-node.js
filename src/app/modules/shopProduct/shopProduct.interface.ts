import { Types } from "mongoose";

export type TSeller = {
  shop: Types.ObjectId;
  price: number;
  quantity: number;
  isStock: boolean;
  shippingTime: number;
  deliveryTime?: number;
  isBuyBoxWinner?: boolean;
};

export type TShopProduct = {
  product: Types.ObjectId;
  asin: string;
  seller: TSeller;
};
