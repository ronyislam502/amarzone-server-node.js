import { Router } from "express";
import { ShopControllers } from "./shop.controller";

const router = Router();

router.post("/create-shop", ShopControllers.createShop);

router.get("/", ShopControllers.allShops);

router.get("/my-shop/:email", ShopControllers.myShop);

router.get("/shop/:id", ShopControllers.singleShop);

export const ShopRoutes = router;
