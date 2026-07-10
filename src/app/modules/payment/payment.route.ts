import express from "express";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";
import { PaymentControllers } from "./payment.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { z } from "zod";

const router = express.Router();

router.post(
  "/create-checkout-session",
  auth(USER_ROLE.CUSTOMER),
  validateRequest(
    z.object({
      body: z.object({
        orderId: z.string({
          required_error: "Order ID is required",
        }),
      }),
    })
  ),
  PaymentControllers.createCheckoutSession
);

export const PaymentRoutes = router;
