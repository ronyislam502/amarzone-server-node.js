import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import { DepartmentValidations } from "./department.validation";
import { DepartmentControllers } from "./department.controller";


const router = Router();

router.post(
    "/create-department",
    validateRequest(DepartmentValidations.createDepartmentValidationSchema),
    DepartmentControllers.createDepartment
);

router.get("/", DepartmentControllers.allDepartments);

router.patch("/update/:id", validateRequest(DepartmentValidations.updateDepartmentValidationSchema), DepartmentControllers.updateDepartment);

export const DepartmentRoutes = router;