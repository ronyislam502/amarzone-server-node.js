import { Router } from "express";
import { VendorControllers } from "./vendor.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { VendorValidations } from "./vendor.validation";

const router = Router();

router.get("/", VendorControllers.allVendors);

router.get("/vendor/:id", VendorControllers.vendor);

router.patch(
    "/update/:id",
    validateRequest(VendorValidations.updateVendorValidationSchema),
    VendorControllers.updateVendor
);

router.delete("/delete/:id", VendorControllers.deleteVendor);

export const VendorRoutes = router;