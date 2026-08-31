import { Router } from "express";
import { VariantControllers } from "./variant.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { VariantValidations } from "./variant.validation";
import { parseBody } from "../../middlewares/bodyParser";
import { multerUpload } from "../../config/multer.config";

const router = Router();

router.post(
    "/create-variant",
    multerUpload.fields([{ name: "images", maxCount: 10 }]),
    parseBody,
    validateRequest(VariantValidations.createVariantValidationSchema),
    VariantControllers.createVariant
);

export const VariantRoutes = router;
