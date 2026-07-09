import { z } from "zod";

const createSellerValidationSchema = z.object({
  price: z.number({
    invalid_type_error: "Price must be number",
    required_error: "Price is required",
  }),
  quantity: z.number({
    invalid_type_error: "Quantity must be number",
    required_error: "Quantity is required",
  }),
  isStock: z
    .boolean({
      invalid_type_error: "isStock must be boolean",
    })
    .optional(),
  fulfillmentBy: z.string({
    invalid_type_error: "Fulfillment by must be string",
    required_error: "Fulfillment by is required",
  }),
  shippingTime: z.number({
    invalid_type_error: "Shipping time must be number",
    required_error: "Shipping time is required",
  }),
  isBuyBoxWinner: z
    .boolean({
      invalid_type_error: "isBuyBoxWinner must be boolean",
    })
    .optional(),
});

const createInventoryValidationSchema = z.object({
  body: z.object({
    asin: z.string({
      invalid_type_error: "ASIN must be string",
      required_error: "ASIN is required",
    }),
    seller: createSellerValidationSchema,
  }),
});

const updateSellerValidationSchema = z.object({
  vendor: z
    .string({
      invalid_type_error: "Vendor must be string",
    })
    .optional(),
  price: z
    .number({
      invalid_type_error: "Price must be number",
    })
    .optional(),
  quantity: z
    .number({
      invalid_type_error: "Quantity must be number",
    })
    .optional(),
  isStock: z
    .boolean({
      invalid_type_error: "isStock must be boolean",
    })
    .optional(),
  fulfillmentBy: z
    .string({
      invalid_type_error: "Fulfillment by must be string",
    })
    .optional(),
  shippingTime: z
    .number({
      invalid_type_error: "Shipping time must be number",
    })
    .optional(),
  isBuyBoxWinner: z
    .boolean({
      invalid_type_error: "isBuyBoxWinner must be boolean",
    })
    .optional(),
});

const updateInventoryValidationSchema = z.object({
  body: z.object({
    product: z
      .string({
        invalid_type_error: "Product must be string",
      })
      .optional(),
    asin: z
      .string({
        invalid_type_error: "ASIN must be string",
      })
      .optional(),
    seller: updateSellerValidationSchema.optional(),
    isDeleted: z
      .boolean({
        invalid_type_error: "isDeleted must be boolean",
      })
      .optional(),
  }),
});

export const InventoryValidations = {
  createInventoryValidationSchema,
  updateInventoryValidationSchema,
};
