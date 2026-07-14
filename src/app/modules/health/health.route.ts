import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { AccountHealthControllers } from "./health.controller";

const router = express.Router();

router.get(
    "/",
    auth(USER_ROLE.VENDOR),
    AccountHealthControllers.getMyHealth
);

router.get(
    "/:vendorId",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    AccountHealthControllers.getVendorHealth
);

router.post(
    "/:vendorId/recalculate",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    AccountHealthControllers.recalculateVendorHealth
);

export const AccountHealthRoutes = router;
