import { z } from "zod";
import { FRAUD_STATUS } from "../../interface/common";

const updateFraudStatusValidationSchema = z.object({
  body: z.object({
    status: z.enum(Object.values(FRAUD_STATUS) as [string, ...string[]], {
      required_error: "Status is required",
    }),
    notes: z.string().optional(),
  }),
});

const evaluateFraudValidationSchema = z.object({
  body: z
    .object({
      userId: z.string().optional(),
    })
    .optional(),
});

export const FraudValidations = {
  updateFraudStatusValidationSchema,
  evaluateFraudValidationSchema,
};
