import express from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import checkVendorNotSuspended from "../../middlewares/checkVendorNotSuspended";
import { USER_ROLE } from "../../interface/common";
import { InventoryValidations } from "./inventory.validation";
import { InventoryControllers } from "./inventory.controller";


const router = express.Router();

router.post(
    "/list", auth(USER_ROLE.VENDOR), checkVendorNotSuspended,
    validateRequest(InventoryValidations.createInventoryValidationSchema),
    InventoryControllers.listProduct
);

router.patch(
    "/update-price/:id",
    auth(USER_ROLE.VENDOR),
    checkVendorNotSuspended,
    validateRequest(InventoryValidations.updatePriceValidationSchema),
    InventoryControllers.updatePrice
);

router.patch(
    "/update-quantity/:id",
    auth(USER_ROLE.VENDOR),
    checkVendorNotSuspended,
    validateRequest(InventoryValidations.updateQuantityValidationSchema),
    InventoryControllers.updateQuantity
);

export const InventoryRoutes = router; 