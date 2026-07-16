import { Types } from "mongoose";

export const DISPUTE_STATUS = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
} as const;

export type TDisputeStatus = keyof typeof DISPUTE_STATUS;

export type TDispute = {
  order: Types.ObjectId;
  customer: Types.ObjectId;
  vendor: Types.ObjectId;
  reason: string;
  details: string;
  evidenceUrls: string[];
  status: TDisputeStatus;
  resolvedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};
