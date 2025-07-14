import { Router } from "express";
import { OrderControllers } from "./order.controller";

const router = Router();

router.post("/create-order", OrderControllers.createOrder);

export const OrderRoutes = router;
