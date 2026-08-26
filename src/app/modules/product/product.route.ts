import { Router } from "express";
import { ProductControllers } from "./product.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { ProductValidations } from "./product.validation";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";

const router = Router();

router.post(
    "/create-product", auth(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN), multerUpload.single("image"), parseBody,
    validateRequest(ProductValidations.createProductValidationSchema),
    ProductControllers.createProduct
);

router.patch(
    "/update-product/:id", multerUpload.single("image"), parseBody,
    validateRequest(ProductValidations.updateProductValidationSchema),
    ProductControllers.updateProduct
);

export const ProductRoutes = router;
