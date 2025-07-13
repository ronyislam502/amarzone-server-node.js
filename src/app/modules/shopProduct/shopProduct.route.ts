import { Router } from "express";
import { ShopProductControllers } from "./shopProduct.controller";

const router = Router();

router.post(
  "/add-product-by-shop/:email",
  ShopProductControllers.addProductByShop
);

router.get(
  "/product-by-sellers/:id",
  ShopProductControllers.singleProductBySellersFromDB
);

router.get(
  "/my-shop-by-products/:email",
  ShopProductControllers.myShopByProducts
);

router.get("/", ShopProductControllers.AllShopProducts);

export const ShopProductRoutes = router;
