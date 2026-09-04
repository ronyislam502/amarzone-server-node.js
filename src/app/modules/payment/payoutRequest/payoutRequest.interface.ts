import { Types } from "mongoose";

export interface TPayoutRequest {
  vendor: Types.ObjectId;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  bankDetails?: string;
  transactionId?: string;
  notes?: string;
}
