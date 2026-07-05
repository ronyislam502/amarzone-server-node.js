import express from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import { ProductControllers } from "./product.controller";
import { ProductValidations } from "./product.validation";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";


const router = express.Router();

router.post(
    "/create-product",
    multerUpload.fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "images", maxCount: 6 },
    ]), parseBody,
    validateRequest(ProductValidations.createProductValidationSchema),
    ProductControllers.createProduct
);





export const ProductRoutes = router;