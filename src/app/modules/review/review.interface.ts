import { Types } from "mongoose";

export type TServiceReview = {
  customer: Types.ObjectId;
  vendor: Types.ObjectId;
  order: Types.ObjectId;
  rating: number;
  title?: string;
  review: string;
  isDeleted: boolean;
};
