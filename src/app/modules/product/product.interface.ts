import { Types } from "mongoose";
import { USER_ROLE } from "./../user/user.const";
import { TSeller } from "../shopProduct/shopProduct.interface";

export type TCreatedBy = {
  role: keyof typeof USER_ROLE;
  id?: Types.ObjectId;
  name: string;
};

export type TProduct = {
  createdBy: TCreatedBy;
  department: Types.ObjectId;
  category: Types.ObjectId;
  asin: string;
  title: string;
  description: string;
  images: string[];
  brand: string;
  isCreatedByVendor: boolean;
  isDeleted: boolean;
};
