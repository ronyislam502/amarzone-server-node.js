import { Types } from "mongoose";

export type TVariantAttribute = {
    type: string;
    value: string;
};

export type TVariant = {
    product: Types.ObjectId;
    asin: string;
    sku: string;
    attributes: TVariantAttribute[];
    images: string[];
    isPrivateLevel: boolean;
    inventories?: Types.ObjectId[];
    isDeleted?: boolean;
};