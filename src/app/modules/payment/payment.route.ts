import { Router } from "express";
import { PaymentControllers } from "./payment.controller";

const router = Router();

// This route receives the raw body from Stripe, which is required for signature verification
router.post("/webhook", PaymentControllers.stripeWebhook);

export const PaymentRoutes = router;
