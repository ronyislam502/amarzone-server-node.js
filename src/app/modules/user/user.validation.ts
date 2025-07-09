import { z } from "zod";
import { USER_STATUS } from "./user.const";

const userValidationSchema = z.object({
  password: z
    .string({
      invalid_type_error: "Password must be string",
    })
    .max(20, { message: "Password can not be more than 20 characters" })
    .optional(),
});

const changeStatusValidationSchema = z.object({
  body: z.object({
    status: z.nativeEnum(USER_STATUS).optional(),
  }),
});
export const UserValidation = {
  userValidationSchema,
  changeStatusValidationSchema,
};
