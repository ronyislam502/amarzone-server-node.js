import { z } from "zod";

const SellerValidationSchema = z.object({
  shop: z.string().min(1, "Shop ID is required"),
  price: z.number().min(0, "Price must be 0 or more"),
  quantity: z.number().min(0, "Quantity must be 0 or more"),
  shippingTime: z.number().min(0, "Shipping time is required"),
  deliveryTime: z.number().optional(),
});

const addShopProductValidation = z.object({
  body: z.object({
    asin: z.string(),
    seller: SellerValidationSchema,
  }),
});

export const ShopProductValidations = {
  addShopProductValidation,
};
