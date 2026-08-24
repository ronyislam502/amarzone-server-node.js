import { Router } from "express";
import { VendorControllers } from "./vendor.controller";

const router = Router();

router.get("/", VendorControllers.allVendors);

router.get("/vendor/:id", VendorControllers.vendor);

router.delete("/delete/:id", VendorControllers.deleteVendor);

export const VendorRoutes = router;