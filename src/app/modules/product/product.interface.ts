import { Types } from "mongoose";
import { USER_ROLE } from "./../user/user.const";

export type TSeller = {
  shop: Types.ObjectId;
  price: number;
  quantity: number;
  isStock: boolean;
  shippingTime: number;
  deliveryTime?: number;
  isBuyBoxWinner?: boolean;
};

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
  sellers: TSeller[];
  isCreatedByVendor: boolean;
  isDeleted: boolean;
};
