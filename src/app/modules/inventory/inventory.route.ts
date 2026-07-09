import express from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { InventoryValidations } from "./inventory.validation";
import { InventoryControllers } from "./inventory.controller";


const router = express.Router();

router.post(
    "/list", auth(USER_ROLE.VENDOR),
    validateRequest(InventoryValidations.createInventoryValidationSchema),
    InventoryControllers.listProduct
);





export const InventoryRoutes = router; 