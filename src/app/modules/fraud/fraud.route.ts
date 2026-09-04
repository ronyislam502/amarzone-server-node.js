import express from "express";
import auth from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validateRequest";
import { USER_ROLE } from "../../interface/common";
import { FraudControllers } from "./fraud.controller";
import { FraudValidations } from "./fraud.validation";

const router = express.Router();

router.get(
  "/",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  FraudControllers.getAllFraudAlerts
);

router.get(
  "/user/:userId",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  FraudControllers.getFraudAlertsByUser
);

router.patch(
  "/:id/status",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest(FraudValidations.updateFraudStatusValidationSchema),
  FraudControllers.updateFraudStatus
);

router.post(
  "/evaluate",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  FraudControllers.evaluateFraudRisk
);

export const FraudRoutes = router;
