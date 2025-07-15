import { Router } from "express";
import { ShopProductControllers } from "./shopProduct.controller";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../user/user.const";

const router = Router();

router.post(
  "/add-product-by-shop/:email",
  auth(USER_ROLE.VENDOR),
  ShopProductControllers.addProductByShop
);

router.get(
  "/product-by-sellers/:id",
  ShopProductControllers.singleProductBySellersFromDB
);

router.get(
  "/my-shop-by-products/:email",
  auth(USER_ROLE.VENDOR),
  ShopProductControllers.myShopByProducts
);

router.get("/", ShopProductControllers.AllShopProducts);

router.patch(
  "/update-shop-selling-info/:id",
  auth(USER_ROLE.VENDOR),
  ShopProductControllers.updateShopProductSellerInfo
);

router.delete(
  "/delete-product-by-shop/:id",
  auth(USER_ROLE.VENDOR),
  ShopProductControllers.productDeleteByShop
);

export const ShopProductRoutes = router;
