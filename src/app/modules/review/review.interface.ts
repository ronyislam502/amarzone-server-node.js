import { Types } from "mongoose";

export type TProductReview = {
  customer: Types.ObjectId;
  order: Types.ObjectId;
  product: Types.ObjectId;
  rating: number;
  comment: string;
};

export type TShopReview = {
  customer: Types.ObjectId;
  order: Types.ObjectId;
  shop: Types.ObjectId;
  feedback: string;
  rating: number;
};
