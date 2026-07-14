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

router.get(
    "/",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    OrderControllers.allOrders
);

router.get(
    "/vendor",
    auth(USER_ROLE.VENDOR),
    OrderControllers.allOrdersByVendor
);

router.get(
    "/customer",
    auth(USER_ROLE.CUSTOMER),
    OrderControllers.allOrdersByCustomer
);

router.patch(
    "/update-tracking/:id",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR),
    validateRequest(OrderValidations.updateOrderTrackingValidationSchema),
    OrderControllers.updateOrderTracking
);

router.patch(
    "/:id/shipping",
    auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR),
    validateRequest(OrderValidations.updateOrderShippingValidationSchema),
    OrderControllers.updateOrderShipping
);

export const OrderRoutes = router;
