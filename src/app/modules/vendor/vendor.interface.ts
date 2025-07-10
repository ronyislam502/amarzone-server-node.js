import { Model, Types } from "mongoose";

export type TAddress = {
  street: string;
  house: string;
  sector: string;
  area: string;
  postalCode: string;
  district: string;
  state: string;
  city: string;
  country: string;
};

export type TVendor = {
  user: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  address: TAddress;
  avatar?: string;
  isShoped: boolean;
  isCreateProduct: boolean;
  isDeleted: boolean;
};

export interface VendorModel extends Model<TVendor> {
  isUserExists(email: string): Promise<TVendor | null>;
}
