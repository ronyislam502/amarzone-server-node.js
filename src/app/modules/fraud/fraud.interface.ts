import { Types } from "mongoose";
import { FRAUD_STATUS } from "../../interface/common";

export interface IFraud {
    user: Types.ObjectId;
    score: number; // 0 - 100
    reasons: string[];
    status: keyof typeof FRAUD_STATUS;
    isDeleted: boolean;

}