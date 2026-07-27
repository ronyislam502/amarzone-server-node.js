import { Router } from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { DashboardControllers } from "./dashboard.controller";

const router = Router();

router.get(
  "/",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  DashboardControllers.getDashboardStatistics
);

export const DashboardRoutes = router;
