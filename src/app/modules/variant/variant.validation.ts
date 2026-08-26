import { z } from "zod";

const variantAttributeSchema = z.object({
  type: z.string({ required_error: "Attribute type is required" }),
  value: z.string({ required_error: "Attribute value is required" }),
});

export const createVariantValidationSchema = z.object({
  body: z.object({
    product: z.string({ required_error: "Product ID is required" }),
    attributes: z.array(variantAttributeSchema).min(1, "At least one attribute is required"),
    isPrivateLevel: z.boolean({ required_error: "isPrivateLevel is required" }).optional().default(false),
  })
});

export const updateVariantValidationSchema = z.object({
  product: z.string().optional(),
  attributes: z.array(variantAttributeSchema).optional(),
  images: z.array(z.string()).optional(),
  isPrivateLevel: z.boolean().optional(),
});

export const VariantValidations = {
  createVariantValidationSchema,
  updateVariantValidationSchema,
};
