import { Types } from "mongoose";

export type TServiceReview = {
    customer: Types.ObjectId;
    vendor: Types.ObjectId;
    order: Types.ObjectId;
    rating: number;
    review: string;
    isDeleted: boolean;
};
