import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { PaymentServices } from "./payment.service";
import config from "../../config";

const createCheckoutSession = catchAsync(async (req, res) => {
  const result = await PaymentServices.createCheckoutSession(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Checkout session created successfully",
    data: result,
  });
});

const handleWebhook = catchAsync(async (req, res) => {
  const signature = req.headers["stripe-signature"] as string;
  const rawBody = req.body;
  const webhookSecret = config.stripe_webhook_secret as string;

  await PaymentServices.processWebhook(rawBody, signature, webhookSecret);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Webhook processed successfully",
    data: null,
  });
});

export const PaymentControllers = {
  createCheckoutSession,
  handleWebhook,
};
