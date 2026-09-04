import { z } from "zod";
import { DISPUTE_STATUS } from "./dispute.interface";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createDisputeZodSchema = z.object({
  body: z.object({
    order: z.string().regex(objectIdRegex, "Invalid order ID format"),
    reason: z.string({ required_error: "Reason is required" }).min(5, "Reason must be at least 5 characters"),
    details: z.string({ required_error: "Details are required" }).min(10, "Details must be at least 10 characters"),
    evidenceUrls: z.array(z.string().url("Invalid evidence URL format")).optional(),
  }),
});

const updateDisputeZodSchema = z.object({
  body: z.object({
    status: z.enum(Object.keys(DISPUTE_STATUS) as [string, ...string[]]).optional(),
    resolvedBy: z.string().regex(objectIdRegex, "Invalid user ID format").optional(),
  }),
});

export const DisputeValidations = {
  createDisputeZodSchema,
  updateDisputeZodSchema,
};
