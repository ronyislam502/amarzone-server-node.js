import { Router } from "express";
import auth from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validateRequest";

import { USER_ROLE } from "../../interface/common";
import { DisputeControllers } from "./dispute.controller";
import { DisputeValidations } from "./dispute.validation";

const router = Router();

// Raise a dispute (Customer only)
router.post(
  "/",
  auth(USER_ROLE.CUSTOMER),
  validateRequest(DisputeValidations.createDisputeZodSchema),
  DisputeControllers.createDispute
);

// Get all disputes for current user (Customer, Vendor, Admin, Super Admin)
router.get(
  "/",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  DisputeControllers.getUserDisputes
);

// Get single dispute (Customer, Vendor, Admin, Super Admin)
router.get(
  "/:id",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  DisputeControllers.getDisputeById
);

// Update dispute status (Admin / Super Admin only)
router.patch(
  "/:id/status",
  auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest(DisputeValidations.updateDisputeZodSchema),
  DisputeControllers.updateDisputeStatus
);

export const DisputeRoutes = router;
