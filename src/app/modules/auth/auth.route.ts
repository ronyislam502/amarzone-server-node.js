import express from "express";
import { AuthControllers } from "./auth.controller";
import {
  validateRequest,
  validateRequestCookies,
} from "../../middlewares/validateRequest";
import { AuthValidations } from "./auth.validation";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";

const router = express.Router();

router.post(
  "/login",
  auth(USER_ROLE.VENDOR, USER_ROLE.ADMIN, USER_ROLE.CUSTOMER),
  validateRequest(AuthValidations.loginValidationSchema),
  AuthControllers.loginUser
);

router.post(
  "/change-password",
  auth(USER_ROLE.VENDOR, USER_ROLE.ADMIN, USER_ROLE.CUSTOMER),
  validateRequest(AuthValidations.changePasswordValidationSchema),
  AuthControllers.changePassword
);

router.post(
  "/refresh-token",
  auth(USER_ROLE.VENDOR, USER_ROLE.ADMIN, USER_ROLE.CUSTOMER),
  validateRequestCookies(AuthValidations.refreshTokenValidationSchema),
  AuthControllers.refreshToken
);

router.post("/forget-password", AuthControllers.forgetPassword);

router.post("/reset-password", AuthControllers.resetPassword);

export const AuthRoutes = router;
