import { Types } from "mongoose";

export type TVariantAttribute = {
    type: string;
    value: string;
};

export type TVariants = {
    product: Types.ObjectId;
    asin: string;
    sku: string;
    attributes: TVariantAttribute[];
    images: string[];
    isPrivateLevel: boolean;
    isDeleted?: boolean;
};