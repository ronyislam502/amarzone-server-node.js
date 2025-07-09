import { z } from "zod";
import {
  createAddressValidationSchema,
  updateAddressValidationSchema,
} from "../vendor/vendor.validation";

const createCustomerValidationSchema = z.object({
  body: z.object({
    password: z.string().max(20).optional(),
    customer: z.object({
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Email is required"),
      phone: z.string().min(4, "Phone is required"),
      address: createAddressValidationSchema,
    }),
  }),
});

const updateCustomerValidationSchema = z.object({
  body: z.object({
    customer: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: updateAddressValidationSchema,
    }),
  }),
});

export const CustomerValidations = {
  createCustomerValidationSchema,
  updateCustomerValidationSchema,
};
