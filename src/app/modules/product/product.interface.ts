import { Types } from "mongoose";
import { USER_ROLE } from "../../interface/common";

export type TVariants = {
    type: string;
    value: string;
};

export type TCreatedBy = {
    role: keyof typeof USER_ROLE;
    id?: Types.ObjectId;
    name: string;
};

export type TProduct = {
    author: TCreatedBy;
    department: Types.ObjectId;
    category: Types.ObjectId;
    asin: string;
    title: string;
    description: string;
    fetures: string[];
    thumbnail: string;
    images?: string[];
    brand: string;
    variants: TVariants[];
    tags: string[];
    isPrivateLevel: boolean;
    isDeleted: boolean;
};
