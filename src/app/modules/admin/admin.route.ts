import { Router } from "express";
import { AdminControllers } from "./admin.controller";

const router = Router();

router.get("/", AdminControllers.AllAdmins);

router.get("/single/:id", AdminControllers.singleAdmin);

router.delete("/delete/:id", AdminControllers.deleteAdmin);

export const AdminRoutes = router;
