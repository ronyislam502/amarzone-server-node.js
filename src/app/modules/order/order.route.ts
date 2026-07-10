import express from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { OrderValidations } from "./order.validation";
import { OrderControllers } from "./order.controller";

const router = express.Router();

router.post(
    "/create-order",
    auth(USER_ROLE.CUSTOMER),
    validateRequest(OrderValidations.createOrderValidationSchema),
    OrderControllers.createOrder
);

export const OrderRoutes = router;
