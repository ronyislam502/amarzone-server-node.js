import express from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import { ProductControllers } from "./product.controller";
import { ProductValidations } from "./product.validation";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import auth from "../../middlewares/auth";
import checkVendorNotSuspended from "../../middlewares/checkVendorNotSuspended";
import { USER_ROLE } from "../../interface/common";

const router = express.Router();

router.post(
    "/create-product",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR),
    checkVendorNotSuspended,
    multerUpload.fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "images", maxCount: 6 },
    ]),
    parseBody,
    validateRequest(ProductValidations.createProductValidationSchema),
    ProductControllers.createProduct
);

router.get(
    "/",
    ProductControllers.allProducts
);

router.get(
    "/my-products",
    auth(USER_ROLE.VENDOR, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    ProductControllers.myCreatedProducts
);

router.get(
    "/:id",
    ProductControllers.getSingleProduct
);

router.patch(
    "/:id",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR),
    checkVendorNotSuspended,
    multerUpload.fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "images", maxCount: 6 },
    ]),
    parseBody,
    validateRequest(ProductValidations.updateProductValidationSchema),
    ProductControllers.updateProduct
);

router.delete(
    "/:id",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR),
    checkVendorNotSuspended,
    ProductControllers.deleteProduct
);

export const ProductRoutes = router;