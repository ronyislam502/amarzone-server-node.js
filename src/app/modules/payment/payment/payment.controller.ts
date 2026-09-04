import { PaymentServices } from "./payment.service";
import catchAsync from "../../../utilities/catchAsync";
import sendResponse from "../../../utilities/sendResponse";
import httpStatus from "http-status";

const stripeWebhook = catchAsync(async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;
    const rawBody = req.body;
    // const webhookSecret = config.stripe_webhook_secret as string;

    const webhookSecret = "whsec_83f429564a34b1d2eb5451ae8d8a8b5be83bbbf77fbbd6305cfa543464440f30" as string;
    await PaymentServices.stripeWebhookPayment(rawBody, signature, webhookSecret);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Webhook processed successfully",
        data: null,
    });
});

export const PaymentControllers = {
    stripeWebhook,
};
