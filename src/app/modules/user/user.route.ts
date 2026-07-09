import express from "express";
import { UserControllers } from "./user.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { AdminValidations } from "../admin/admin.validation";
import { VendorValidations } from "../vendor/vendor.validation";
import { CustomerValidations } from "../customer/customer.validation";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";

const router = express.Router();

router.post(
  "/create-admin",
  multerUpload.single("image"),
  parseBody,
  validateRequest(AdminValidations.createAdminValidationSchema),
  UserControllers.createAdmin
);

router.post(
  "/create-vendor",
  multerUpload.single("image"),
  parseBody,
  validateRequest(VendorValidations.createVendorValidationSchema),
  UserControllers.createVendor
);

router.post(
  "/create-customer",
  // multerUpload.single("image"),
  // parseBody,
  validateRequest(CustomerValidations.createCustomerValidationSchema),
  UserControllers.createCustomer
);




export const UserRoutes = router;
