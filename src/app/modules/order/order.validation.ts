import { z } from "zod";

const createOrderValidationSchema = z.object({
  body: z.object({
    vendor: z.string({
      required_error: "Vendor ID is required",
    }),
    products: z
      .array(
        z.object({
          product: z.string({
            required_error: "Product ID is required",
          }),
          quantity: z
            .number({
              required_error: "Quantity is required",
            })
            .min(1, "Quantity must be at least 1"),
        })
      )
      .min(1, "At least one product is required"),
  }),
});

export const OrderValidations = {
  createOrderValidationSchema,
};
