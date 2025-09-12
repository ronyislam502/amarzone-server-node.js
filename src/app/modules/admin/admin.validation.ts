import { z } from "zod";
import { Gender } from "../../utilities/const";

export  const addressValidationSchema = z.object({
  Village: z.string().min(1, 'Village is required'),
  postOffice: z.string().min(1, 'Post office is required'),
  postalCode: z.string().optional(),
  policeStation: z.string().min(1, 'Police station is required'),
  district: z.string().min(1, 'District is required'),
  division: z.string().min(1, 'Division is required'),
  country: z.string().min(1, 'Country is required'),
});

const createAdminValidationSchema = z.object({
  body: z.object({
    password: z.string().max(20).optional(),
    admin: z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
        designation: z.string().min(1, 'Designation is required'),
        gender: z.nativeEnum(Gender),
        avatar: z.string().url('Invalid avatar URL').optional(),
        phone: z.string().min(1, 'Phone number is required'),
        nidNo: z.string().min(1, 'NID number is required'),
        nidImg: z.string().url('Invalid NID image URL').optional(),
        dateOfBirth: z.coerce.date().optional(),
        presentAddress: addressValidationSchema,
        permanentAddress: addressValidationSchema,
    }),
  }),
});

const updateAdminValidationSchema = z.object({
  body: z.object({
    admin: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    }),
  }),
});

export const AdminValidations = {
  createAdminValidationSchema,
  updateAdminValidationSchema,
};
