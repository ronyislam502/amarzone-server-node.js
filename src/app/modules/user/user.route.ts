import { Router } from "express";
import { UserControllers } from "./user.controller";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import { validateRequest } from "../../middlewares/validateRequest";
import { AdminValidations } from "../admin/admin.validation";

const router = Router();

router.post("/create-admin", multerUpload.single('image'), parseBody, validateRequest(AdminValidations.createAdminValidationSchema), UserControllers.createAdmin);

export const UserRoutes = router;