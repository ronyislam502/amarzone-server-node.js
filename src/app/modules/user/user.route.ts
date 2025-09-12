import express from "express";
import { UserControllers } from "./user.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { AdminValidations } from "../admin/admin.validation";
import { parseBody } from "../../middlewares/bodyParser";
import { multerUpload } from "../../config/multer.config";

const router = express.Router();

router.post(
  "/create-admin",
  multerUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "nidImg", maxCount: 2 },
  ]),
  parseBody,
  validateRequest(AdminValidations.createAdminValidationSchema),
  UserControllers.createAdmin
);

router.post(
  "/create-staff",
  multerUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "nidImg", maxCount: 2 },
  ]),
  parseBody,
  validateRequest(AdminValidations.createAdminValidationSchema),
  UserControllers.createAdmin
);

router.get("/", UserControllers.getAllUsers);

export const UserRoutes = router;
