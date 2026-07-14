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

const updateOrderTrackingValidationSchema = z.object({
  body: z.object({
    trackingNumber: z.string({
      required_error: "Tracking number is required",
    }),
    courier: z.string({
      required_error: "Courier ID is required",
    }),
    shippedAt: z.string().optional(),
    estimatedDelivery: z.string().optional(),
    deliveredAt: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const updateOrderShippingValidationSchema = z.object({
  body: z.object({
    courier: z.string().optional(),
    trackingNumber: z.string().optional(),
    estimatedDelivery: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const OrderValidations = {
  createOrderValidationSchema,
  updateOrderTrackingValidationSchema,
  updateOrderShippingValidationSchema,
};
