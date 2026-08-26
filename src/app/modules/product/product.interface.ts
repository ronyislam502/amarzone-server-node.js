import { Types } from "mongoose";
import { USER_ROLE } from "../../interface/common";


export type TCreatedBy = {
    name: string;
    role: keyof typeof USER_ROLE;
};

export type TProduct = {
    author: TCreatedBy;
    department: Types.ObjectId;
    category: Types.ObjectId;
    title: string;
    features: string[];
    thumbnail: string;
    brand: string;
    variants: Types.ObjectId[];
    tags: string[];
    isBestSeller?: boolean;
    isDeleted: boolean;
};


