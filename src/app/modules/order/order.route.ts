
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { OrderControllers } from "./order.controller";
import { Router } from "express";


const router = Router();

router.post(
    "/create-order",
    auth(USER_ROLE.CUSTOMER),
    OrderControllers.createOrder
);

router.get(
    "/",
    // auth(USER_ROLE.ADMIN),
    OrderControllers.getAllOrders
);

router.get(
    "/my-orders",
    auth(USER_ROLE.CUSTOMER, USER_ROLE.VENDOR),
    OrderControllers.allOrdersByUser
);

export const OrderRoutes = router;
