import { Router } from "express";
import { StaffControllers } from "./Staff.controller";

const router = Router();

router.get("/", StaffControllers.allStaffs);

router.get("/:id", StaffControllers.singleStaff);

export const StaffRoutes = router;
