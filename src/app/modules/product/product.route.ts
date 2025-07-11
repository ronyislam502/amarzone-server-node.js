import { Router } from "express";
import { ProductControllers } from "./product.controller";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../user/user.const";

const router = Router();

router.post(
  "/create-product",
  auth(USER_ROLE.ADMIN, USER_ROLE.VENDOR),
  ProductControllers.createProduct
);

router.get("/", ProductControllers.allProducts);

router.get("/offered-products", ProductControllers.offeredProducts);

router.get(
  "/my-created-products/:email",
  // auth(USER_ROLE.ADMIN, USER_ROLE.VENDOR),
  ProductControllers.myCreatedProducts
);

export const ProductRoutes = router;
