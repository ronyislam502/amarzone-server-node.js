import { Router } from "express";
import { ShopControllers } from "./shop.controller";

const router = Router();

router.post("/create-shop", ShopControllers.createShop);

router.get("/", ShopControllers.allShops);

router.get("/my-shop/:email", ShopControllers.myShop);

export const ShopRoutes = router;
