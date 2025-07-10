import { z } from "zod";

const createProductValidationSchema = z.object({
  body: z.object({
    createdBy: z.string({
      invalid_type_error: "createdBy id must be string",
    }),
    department: z.string({
      invalid_type_error: "department id must be string",
    }),
    category: z.string({
      invalid_type_error: "category id must be string",
    }),
    title: z.string().min(1, "product Title is required"),
    description: z.string().min(1, "product description is required"),
    brand: z.string().min(1, "product brand is required"),
  }),
});

const updateProductValidationSchema = z.object({
  body: z.object({
    createdBy: z.string().optional(),
    department: z.string().optional(),
    category: z.string().optional(),
    asin: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    brand: z.string().optional(),
  }),
});

export const ProductValidations = {
  createProductValidationSchema,
  updateProductValidationSchema,
};
