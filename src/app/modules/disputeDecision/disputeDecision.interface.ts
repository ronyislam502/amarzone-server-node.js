import { Types } from "mongoose";

export const DECISION_TYPE = {
  REFUNDED: "REFUNDED",
  REJECTED: "REJECTED",
} as const;

export type TDecisionType = keyof typeof DECISION_TYPE;

export type TDisputeDecision = {
  dispute: Types.ObjectId;
  resolvedBy: Types.ObjectId;
  decision: TDecisionType;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
};
