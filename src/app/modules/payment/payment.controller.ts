import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { PaymentServices } from "./payment.service";

const paymentSuccess = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const result = await PaymentServices.paymentSuccessIntoDB(orderId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment successfully",
    data: result,
  });
});

const validatePayment = catchAsync(async (req, res) => {
  const result = await PaymentServices.validatePaymentFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment validate successfully!",
    data: result,
  });
});

const allSuccessPayments = catchAsync(async (req, res) => {
  const result = await PaymentServices.allSuccessPaymentsFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "all success payments retrieved successfully!",
    data: result,
  });
});

export const PaymentControllers = {
  paymentSuccess,
  validatePayment,
  allSuccessPayments,
};
