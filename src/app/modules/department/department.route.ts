import { Router } from "express";
import { DepartmentControllers } from "./department.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { DepartmentValidations } from "./department.validation";

const router = Router();

router.post(
  "/create-department",
  validateRequest(DepartmentValidations.createDepartmentValidationSchema),
  DepartmentControllers.createDepartment
);

router.get("/", DepartmentControllers.allDepartments);

router.patch(
  "/update/:id",
  validateRequest(DepartmentValidations.updateDepartmentValidationSchema),
  DepartmentControllers.updateDepartments
);

export const DepartmentRoutes = router;
