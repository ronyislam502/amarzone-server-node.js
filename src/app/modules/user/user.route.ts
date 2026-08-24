import { Router } from "express";
import { UserControllers } from "./user.controller";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import { validateRequest } from "../../middlewares/validateRequest";
import { AdminValidations } from "../admin/admin.validation";
import { VendorValidations } from "../vendor/vendor.validation";

const router = Router();

router.post("/create-admin", multerUpload.single('image'), parseBody, validateRequest(AdminValidations.createAdminValidationSchema), UserControllers.createAdmin);

router.post("/create-vendor", multerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
]), parseBody, validateRequest(VendorValidations.createVendorValidationSchema), UserControllers.createVendor);

export const UserRoutes = router;