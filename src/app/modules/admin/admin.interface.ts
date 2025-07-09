import { Model, Types } from "mongoose";
import { USER_STATUS } from "../user/user.const";

export type TAdmin = {
  user: Types.ObjectId;
  name: string;
  email: string;
  avatar?: string;
  phone: string;
  isDeleted: boolean;
};

export interface AdminModel extends Model<TAdmin> {
  isUserExists(email: string): Promise<TAdmin | null>;
}
