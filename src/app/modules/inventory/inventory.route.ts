import { Router } from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { validateRequest } from "../../middlewares/validateRequest";
import { InventoryValidations } from "./inventory.validation";
import { InventoryControllers } from "./inventory.controller";

const router = Router();

router.post("/list-product", auth(USER_ROLE.VENDOR), validateRequest(InventoryValidations.createInventoryValidationSchema),
    InventoryControllers.listProduct);


export const InventoryRoutes = router;