import { Types } from "mongoose";

export type TProductReview = {
  customer: Types.ObjectId;
  product: Types.ObjectId;
  order: Types.ObjectId;
  rating: number;
  title?: string;
  review: string;
  isDeleted: boolean;
};
