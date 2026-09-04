import { Types } from "mongoose";
import { FRAUD_STATUS } from "../../interface/common";

export interface IFraud {
    user: Types.ObjectId | any;
    score: number; // 0 - 100
    reasons: string[];
    status: keyof typeof FRAUD_STATUS;
    reviewedBy?: Types.ObjectId | any;
    notes?: string;
    isResolved: boolean;
    isDeleted?: boolean;
}