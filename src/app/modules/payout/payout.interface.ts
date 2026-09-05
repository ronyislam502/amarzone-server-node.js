import { Types } from "mongoose";

export type TPayout = {
  vendor: Types.ObjectId;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  bankDetails?: string;
  transactionId?: string;
  notes?: string;
}
