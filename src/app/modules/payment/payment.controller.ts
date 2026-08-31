import { Request, Response } from "express";
import { PaymentServices } from "./payment.service";

const stripeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;

    try {
        await PaymentServices.stripeWebhook(req.body, signature);
        // Stripe requires a 200 response to acknowledge receipt of the event
        res.json({ received: true });
    } catch (err: any) {
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
};

export const PaymentControllers = {
    stripeWebhook,
};
