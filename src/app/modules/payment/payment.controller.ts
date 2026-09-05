import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { PaymentServices } from "./payment.service";
import config from "../../config";


const stripeWebhook = catchAsync(async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;
    const rawBody = req.body;
    const webhookSecret = config.stripe_webhook_secret as string;

    const result = await PaymentServices.stripeWebhookPayment(rawBody, signature, webhookSecret);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Webhook processed successfully",
        data: result,
    });
});

export const PaymentControllers = {
    stripeWebhook,
};
