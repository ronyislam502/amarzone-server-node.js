import { Router } from "express";
import auth from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validateRequest";

import { USER_ROLE } from "../../interface/common";
import { DisputeDecisionControllers } from "./disputeDecision.controller";
import { DisputeDecisionValidations } from "./disputeDecision.validation";

const router = Router();

// Create dispute decision (Admin / Super Admin only)
router.post(
  "/",
  auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest(DisputeDecisionValidations.createDisputeDecisionZodSchema),
  DisputeDecisionControllers.createDecision
);

// Get decision by dispute ID (Customer, Vendor, Admin, Super Admin)
router.get(
  "/:disputeId",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  DisputeDecisionControllers.getDecisionByDisputeId
);

export const DisputeDecisionRoutes = router;
