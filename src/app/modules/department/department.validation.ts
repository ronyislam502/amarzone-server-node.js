import { z } from "zod";

const createDepartmentValidationSchema = z.object({
  body: z.object({
    name: z.string({
      invalid_type_error: "street must be string",
    }),
  }),
});

const updateDepartmentValidationSchema = z.object({
  body: z.object({
    name: z.string().optional(),
  }),
});

export const DepartmentValidations = {
  createDepartmentValidationSchema,
  updateDepartmentValidationSchema,
};
