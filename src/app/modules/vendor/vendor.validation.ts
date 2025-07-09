import { z } from "zod";

export const createAddressValidationSchema = z.object({
  street: z.string({
    invalid_type_error: "street must be string",
  }),
  city: z.string({
    invalid_type_error: "city must be string",
  }),
  state: z.string({
    invalid_type_error: "city must be string",
  }),
  area: z.string({
    invalid_type_error: "city must be string",
  }),
  postalCode: z.string({
    invalid_type_error: "city must be string",
  }),
  country: z.string({
    invalid_type_error: "city must be string",
  }),
});

const createVendorValidationSchema = z.object({
  body: z.object({
    password: z.string().max(20).optional(),
    vendor: z.object({
      name: z.string().min(1, "Seller name is required"),
      email: z.string().email("Email is required"),
      phone: z.string().min(6, "Phone is required"),
      address: createAddressValidationSchema,
    }),
  }),
});

export const updateAddressValidationSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  area: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

const updateVendorValidationSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: updateAddressValidationSchema,
    shopName: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const VendorValidations = {
  createVendorValidationSchema,
  updateVendorValidationSchema,
};
