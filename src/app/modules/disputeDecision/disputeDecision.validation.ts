import { z } from "zod";
import { DECISION_TYPE } from "./disputeDecision.interface";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createDisputeDecisionZodSchema = z.object({
  body: z.object({
    dispute: z.string().regex(objectIdRegex, "Invalid dispute ID format"),
    decision: z.enum(Object.keys(DECISION_TYPE) as [string, ...string[]], {
      required_error: "Decision is required",
    }),
    notes: z.string({ required_error: "Notes are required" }).min(5, "Notes must be at least 5 characters"),
  }),
});

export const DisputeDecisionValidations = {
  createDisputeDecisionZodSchema,
};
