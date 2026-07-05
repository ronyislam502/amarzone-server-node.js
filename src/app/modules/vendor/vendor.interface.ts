import { Model, Types } from "mongoose";
import { TAddress } from "../user/user.interface";



export type TVendor = {
  user: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  address: TAddress;
  logo?: string;
  banner?: string;
  isDeleted: boolean;
};

export interface VendorModel extends Model<TVendor> {
  isUserExists(email: string): Promise<TVendor | null>;
}
