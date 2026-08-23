import { Router } from "express";
import { AdminControllers } from "./admin.controller";

const router = Router();

router.get("/", AdminControllers.allAdmins);

router.get("/admin/:id", AdminControllers.admin);

router.delete("/delete/:id", AdminControllers.deleteAdmin);

export const AdminRoutes = router;