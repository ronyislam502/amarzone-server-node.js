import { z } from "zod";

const createDepartmentValidationSchema = z.object({
  body: z.object({
    title: z.string({
      invalid_type_error: "title must be string",
    }),
  }),
});

const updateDepartmentValidationSchema = z.object({
  body: z.object({
    title: z.string({
      invalid_type_error: "title must be string",
    }).optional(),
  }),
});

export const DepartmentValidations = {
  createDepartmentValidationSchema,
  updateDepartmentValidationSchema,
};
