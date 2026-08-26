import { z } from "zod";


const createProductValidationSchema = z.object({
  body: z.object({
    department: z.string({ required_error: "Department ID is required" }),
    category: z.string({ required_error: "Category ID is required" }),
    title: z.string({ required_error: "Title is required" }),
    features: z.array(z.string()).min(1, "At least one feature is required"),
    brand: z.string({ required_error: "Brand is required" }),
    tags: z.array(z.string()).min(1, "At least one tag is required"),
    isBestSeller: z.boolean().optional(),
  }),
});

const updateProductValidationSchema = z.object({
  body: z.object({
    department: z.string().optional(),
    category: z.string().optional(),
    title: z.string().optional(),
    features: z.array(z.string()).min(1, "At least one feature is required").optional(),
    brand: z.string().optional(),
    tags: z.array(z.string()).min(1, "At least one tag is required").optional(),
    isBestSeller: z.boolean().optional(),
  }),
});

export const ProductValidations = {
  createProductValidationSchema,
  updateProductValidationSchema,
};
