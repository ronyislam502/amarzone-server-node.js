import { Types } from "mongoose";

export type TShop = {
  vendor: Types.ObjectId;
  shopName: string;
  shopEmail: string;
  shopPhone: string;
  logo: string;
  isSuspended: boolean;
};
