import { Schema, model } from "mongoose";
import { DECISION_TYPE, TDisputeDecision } from "./disputeDecision.interface";

const disputeDecisionSchema = new Schema<TDisputeDecision>(
  {
    dispute: {
      type: Schema.Types.ObjectId,
      ref: "Dispute",
      required: true,
      unique: true,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    decision: {
      type: String,
      enum: Object.keys(DECISION_TYPE),
      required: true,
    },
    notes: {
      type: String,
      required: [true, "Decision notes are required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DisputeDecision = model<TDisputeDecision>(
  "DisputeDecision",
  disputeDecisionSchema
);
