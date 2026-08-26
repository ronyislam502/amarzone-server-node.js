import { z } from "zod";

const variantAttributeSchema = z.object({
  type: z.string({ required_error: "Attribute type is required" }),
  value: z.string({ required_error: "Attribute value is required" }),
});

export const createVariantValidationSchema = z.object({
  asin: z.string({ required_error: "ASIN is required" }),
  sku: z.string({ required_error: "SKU is required" }),
  attributes: z.array(variantAttributeSchema).min(1, "At least one attribute is required"),
  thumbnail: z.string({ required_error: "Thumbnail is required" }),
  images: z.array(z.string()).min(1, "At least one image is required"),
  isPrivateLevel: z.boolean({ required_error: "isPrivateLevel is required" }),
});

export const updateVariantValidationSchema = z.object({
  asin: z.string().optional(),
  sku: z.string().optional(),
  attributes: z.array(variantAttributeSchema).optional(),
  thumbnail: z.string().optional(),
  images: z.array(z.string()).optional(),
  isPrivateLevel: z.boolean().optional(),
});

export const VariantValidations = {
  createVariantValidationSchema,
  updateVariantValidationSchema,
};
