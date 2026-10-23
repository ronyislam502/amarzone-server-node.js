import { Types } from "mongoose";

export type TProductReview = {
  customer: Types.ObjectId;
  variant: Types.ObjectId;
  order: Types.ObjectId;
  rating: number;
  review: string;
  isDeleted: boolean;
};
