import { z } from "zod";

const createServiceReviewValidationSchema = z.object({
  body: z.object({
    customer: z.string({
      invalid_type_error: "Customer must be string",
    }),
    vendor: z.string({
      invalid_type_error: "Vendor must be string",
    }),
    order: z.string({
      invalid_type_error: "Order must be string",
    }),
    rating: z.number({
      invalid_type_error: "Rating must be number",
    }),
    title: z.string().optional(),
    review: z.string({
      invalid_type_error: "Review must be string",
    }),
  }),
});

export const ServiceReviewValidations = {
  createServiceReviewValidationSchema,
};
