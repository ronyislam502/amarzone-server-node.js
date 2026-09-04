import { Router } from "express";
import { UserControllers } from "./user.controller";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import { validateRequest } from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { AdminValidations } from "../admin/admin.validation";
import { VendorValidations } from "../vendor/vendor.validation";
import { CustomerValidations } from "../customer/customer.validation";

const router = Router();

router.post("/create-admin", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), multerUpload.single("image"), parseBody, validateRequest(AdminValidations.createAdminValidationSchema), UserControllers.createAdmin);

router.post("/create-vendor", multerUpload.fields([{ name: "logo", maxCount: 1 }, { name: "banner", maxCount: 1 }]), parseBody, validateRequest(VendorValidations.createVendorValidationSchema), UserControllers.createVendor);

router.post("/create-customer", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), multerUpload.single("image"), parseBody, validateRequest(CustomerValidations.createCustomerValidationSchema), UserControllers.createCustomer);


export const UserRoutes = router;