import { Router } from "express";
import { AdminControllers } from "./admin.controller";
import { USER_ROLE } from "../../interface/common";
import auth from "../../middlewares/auth";

const router = Router();

router.get("/", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), AdminControllers.allAdmins);

router.get("/admin/:id", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), AdminControllers.admin);

router.patch("/update/:id", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), AdminControllers.updateAdmin);

router.delete("/delete/:id", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), AdminControllers.deleteAdmin);

export const AdminRoutes = router;