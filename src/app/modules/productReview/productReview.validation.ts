import { z } from "zod";

const createProductReviewValidationSchema = z.object({
  body: z.object({
    product: z.string({
      required_error: "Product ID is required",
      invalid_type_error: "Product ID must be a string",
    }),
    order: z.string({
      required_error: "Order ID is required",
      invalid_type_error: "Order ID must be a string",
    }),
    rating: z
      .number({
        required_error: "Rating is required",
        invalid_type_error: "Rating must be a number",
      })
      .min(1, { message: "Rating must be at least 1" })
      .max(5, { message: "Rating cannot be more than 5" }),
    title: z
      .string({
        invalid_type_error: "Title must be a string",
      })
      .optional(),
    review: z.string({
      required_error: "Review text is required",
      invalid_type_error: "Review text must be a string",
    }),
  }),
});

const updateProductReviewValidationSchema = z.object({
  body: z.object({
    rating: z
      .number({
        invalid_type_error: "Rating must be a number",
      })
      .min(1, { message: "Rating must be at least 1" })
      .max(5, { message: "Rating cannot be more than 5" })
      .optional(),
    title: z
      .string({
        invalid_type_error: "Title must be a string",
      })
      .optional(),
    review: z
      .string({
        invalid_type_error: "Review text must be a string",
      })
      .optional(),
  }),
});

export const ProductReviewValidations = {
  createProductReviewValidationSchema,
  updateProductReviewValidationSchema,
};
