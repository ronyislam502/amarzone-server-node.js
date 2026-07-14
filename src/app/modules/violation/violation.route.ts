import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { SlaViolationControllers } from "./violation.controller";

const router = express.Router();

router.get(
  "/my-violations",
  auth(USER_ROLE.VENDOR),
  SlaViolationControllers.getMyViolations
);

router.get(
  "/",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  SlaViolationControllers.getAllViolations
);

router.get(
  "/:vendorId",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  SlaViolationControllers.getVendorViolations
);

export const SlaViolationRoutes = router;
