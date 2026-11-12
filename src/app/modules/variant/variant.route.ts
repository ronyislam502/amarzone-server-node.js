import { Router } from "express";
import { VariantControllers } from "./variant.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { VariantValidations } from "./variant.validation";
import { parseBody } from "../../middlewares/bodyParser";
import { multerUpload } from "../../config/multer.config";

const router = Router();

router.post(
    "/create-variant",
    multerUpload.fields([{ name: "images", maxCount: 4 }]),
    parseBody,
    validateRequest(VariantValidations.createVariantValidationSchema),
    VariantControllers.createVariant
);

router.get(
    "/variants-product/:id",
    VariantControllers.allVariantsByProduct
);

router.get(
    "/all-variants-products",
    VariantControllers.allVariantsProducts
);

router.get(
    "/all-variants-products-department/:id",
    VariantControllers.allVariantsProductsByDepartment
);

router.get(
    "/all-variants-products-category/:id",
    VariantControllers.allVariantsProductsByCategory
);

export const VariantRoutes = router;
