import { z } from "zod";

const createCategoryValidationSchema = z.object({
  body: z.object({
    department: z.string({
      invalid_type_error: "Department must be string",
    }),
    title: z.string({
      invalid_type_error: "title must be string",
    }),
  }),
});

const updateCategoryValidationSchema = z.object({
  body: z.object({
    department: z.string().optional(),
    title: z.string().optional(),
  }),
});

export const CategoryValidations = {
  createCategoryValidationSchema,
  updateCategoryValidationSchema,
};
