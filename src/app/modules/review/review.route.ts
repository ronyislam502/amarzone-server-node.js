import { Router } from "express";
import { ReviewControllers } from "./review.controller";

const router = Router();

router.post("/create-product-review", ReviewControllers.createProductReview);

router.get("/product-reviews/:id", ReviewControllers.singleProductReviews);

router.post("/create-shop-review/:email", ReviewControllers.createShopReview);

router.get("/shop-reviews/:id", ReviewControllers.singleShopReviews);

export const ReviewRoutes = router;
