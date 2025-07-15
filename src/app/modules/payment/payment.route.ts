import { Router } from "express";
import { PaymentControllers } from "./payment.controller";

const router = Router();

router.get("/ipn", PaymentControllers.validatePayment);

router.post("/payment-success/:orderId", PaymentControllers.paymentSuccess);

router.get("/", PaymentControllers.allSuccessPayments);

export const PaymentRoutes = router;
