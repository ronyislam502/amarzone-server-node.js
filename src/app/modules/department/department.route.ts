import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import { DepartmentValidations } from "./department.validation";
import { DepartmentControllers } from "./department.controller";
import { USER_ROLE } from "../../interface/common";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import auth from "../../middlewares/auth";


const router = Router();

router.post(
    "/create-department", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
    multerUpload.single("icon"), parseBody,
    validateRequest(DepartmentValidations.createDepartmentValidationSchema),
    DepartmentControllers.createDepartment
);

router.get("/", DepartmentControllers.allDepartments);

router.patch("/update/:id", validateRequest(DepartmentValidations.updateDepartmentValidationSchema), DepartmentControllers.updateDepartment);

export const DepartmentRoutes = router;