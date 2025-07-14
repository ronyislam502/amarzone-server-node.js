import express from "express";
import { UserControllers } from "./user.controller";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import { validateRequest } from "../../middlewares/validateRequest";
import { AdminValidations } from "../admin/admin.validation";
import { VendorValidations } from "../vendor/vendor.validation";
import { CustomerValidations } from "../customer/customer.validation";

const router = express.Router();

router.post(
  "/create-admin",
  // multerUpload.single("image"),
  // parseBody,
  validateRequest(AdminValidations.createAdminValidationSchema),
  UserControllers.createAdmin
);

router.post(
  "/create-vendor",
  // multerUpload.single("image"),
  // parseBody,
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

router.get("/", UserControllers.getAllUsers);

router.patch("/shop-status/:id", UserControllers.shopStatusChange);

router.patch(
  "/product-create-permission/:id",
  UserControllers.productCreatePermission
);

export const UserRoutes = router;
