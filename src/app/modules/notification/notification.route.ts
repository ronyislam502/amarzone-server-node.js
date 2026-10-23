import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { NotificationControllers } from "./notification.controller";

const router = express.Router();

router.get(
    "/",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR, USER_ROLE.CUSTOMER),
    NotificationControllers.getMyNotifications
);

router.patch(
    "/:id/read",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR, USER_ROLE.CUSTOMER),
    NotificationControllers.markAsRead
);

export const NotificationRoutes = router;
