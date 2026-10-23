import { Model, Types } from "mongoose";
import { TAddress } from "../user/user.interface";

export type TAdmin = {
    user: Types.ObjectId;
    name: string;
    email: string;
    avatar?: string;
    phone: string;
    address: TAddress;
    isDeleted: boolean;
};

export interface AdminModel extends Model<TAdmin> {
    isUserExists(email: string): Promise<TAdmin | null>;
}
