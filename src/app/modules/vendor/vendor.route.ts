import { Router } from "express";
import { VendorControllers } from "./vendor.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { VendorValidations } from "./vendor.validation";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";

const router = Router();

router.get("/", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), VendorControllers.allVendors);

router.get("/vendor/:id", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), VendorControllers.vendor);

router.patch(
    "/update/:id", auth(USER_ROLE.VENDOR),
    validateRequest(VendorValidations.updateVendorValidationSchema),
    VendorControllers.updateVendor
);

router.delete("/delete/:id", VendorControllers.deleteVendor);

export const VendorRoutes = router;