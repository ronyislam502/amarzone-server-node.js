import express from "express";
import { AuthControllers } from "./auth.controller";
import {
  validateRequest,
  validateRequestCookies,
} from "../../middlewares/validateRequest";
import { AuthValidations } from "./auth.validation";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../user/user.const";

const router = express.Router();

router.post(
  "/login",
  validateRequest(AuthValidations.loginValidationSchema),
  AuthControllers.loginUser
);

router.post(
  "/change-password",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validateRequest(AuthValidations.changePasswordValidationSchema),
  AuthControllers.changePassword
);

router.post(
  "/refresh-token",
  validateRequestCookies(AuthValidations.refreshTokenValidationSchema),
  AuthControllers.refreshToken
);

router.post("/forget-password", AuthControllers.forgetPassword);

router.post("/reset-password", AuthControllers.resetPassword);

export const AuthRoutes = router;
