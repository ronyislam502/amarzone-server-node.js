import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { AccountHealthControllers } from "./health.controller";

const router = express.Router();

// Retrieve vendor's own account health (calculations run automatically via cron job)
router.get(
    "/my-health",
    auth(USER_ROLE.VENDOR),
    AccountHealthControllers.getMyHealth
);

export const AccountHealthRoutes = router;
