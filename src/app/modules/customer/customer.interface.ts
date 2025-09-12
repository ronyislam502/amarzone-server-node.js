import { Model, Types } from "mongoose";
import { TAddress } from "../vendor/vendor.interface";

export type TCustomer = {
  user: Types.ObjectId;
  name: string;
  email: string;
  avatar?: string;
  phone: string;
  address: TAddress;
  isDeleted: boolean;
};

export interface CustomerModel extends Model<TCustomer> {
  isUserExists(email: string): Promise<TCustomer | null>;
}
