import { Router } from "express";
import { OrderControllers } from "./order.controller";

const router = Router();

router.post("/create-order", OrderControllers.createOrder);

router.get("/", OrderControllers.allOrders);

router.get("/vendor-orders/:email", OrderControllers.vendorAllOrders);

router.get("/customer-orders/:email", OrderControllers.customerAllOrders);

router.get("/order/:id", OrderControllers.singleOrder);

export const OrderRoutes = router;
