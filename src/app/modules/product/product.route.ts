import { Router } from "express";
import { ProductControllers } from "./product.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { ProductValidations } from "./product.validation";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";

const router = Router();

router.post(
    "/create-product", multerUpload.single("image"), parseBody,
    validateRequest(ProductValidations.createProductValidationSchema),
    ProductControllers.createProduct
);

router.patch(
    "/update-product/:id", multerUpload.single("image"), parseBody,
    validateRequest(ProductValidations.updateProductValidationSchema),
    ProductControllers.updateProduct
);

export const ProductRoutes = router;
