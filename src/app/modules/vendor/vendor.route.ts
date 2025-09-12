import { Router } from "express";
import { VendorControllers } from "./vendor.controller";

const router = Router();

router.get("/", VendorControllers.allVendors);

router.get("/single/:id", VendorControllers.singleVendor);

router.patch("/update/:id", VendorControllers.updateVendor);

router.delete("/delete/:id", VendorControllers.deleteVendor);

export const VendorRoutes = router;
