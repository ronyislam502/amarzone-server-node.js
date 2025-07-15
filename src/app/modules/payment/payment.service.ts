import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Order } from "../order/order.model";
import { PAYMENT_STATUS } from "../order/order.interface";
import { initialPayment, validatePayment } from "./payment.utilities";
import { Payment } from "./payment.model";
import mongoose from "mongoose";
import { populate } from "dotenv";

const paymentSuccessIntoDB = async (orderId: string) => {
  const isOrder = await Order.findById(orderId);

  if (!isOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "This order not found");
  }

  const paymentData = {
    transactionId: isOrder.transactionId,
    order: isOrder._id,
    user: isOrder?.customer?._id,
    amount: isOrder.grandAmount,
    status: PAYMENT_STATUS.PENDING,
  };

  const result = await initialPayment(paymentData);

  return result;
};

const validatePaymentFromDB = async (payload: any) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  //   if (!payload || !payload?.status || !(payload?.status === "VALID")) {
  //     return {
  //       message: "Invalid Payment!",
  //     };
  //   }

  //   const response = await validatePayment(payload);

  //   if (response?.status !== "VALID") {
  //     return {
  //       message: "Payment Failed!",
  //     };
  //   }

  try {
    const response = payload;

    const updatedPayment = await Payment.findOneAndUpdate(
      { transactionId: response?.tran_id },
      {
        status: PAYMENT_STATUS.PAID,
        paymentGatewayData: response,
      },
      { new: true, session }
    );

    if (!updatedPayment) {
      throw new Error("Payment not found");
    }

    await Order.findByIdAndUpdate(
      updatedPayment?.order?._id,
      { paymentStatus: PAYMENT_STATUS.PAID },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { message: "Payment success" };
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Payment validation failed: ${error.message}`);
  }
};

const allSuccessPaymentsFromDB = async () => {
  const result = await Payment.find().populate({
    path: "order",
    populate: [
      {
        path: "customer",
        select: "name email phone",
      },
      {
        path: "products.product",
        select: "title price",
      },
      {
        path: "shop",
        select: "shopName",
      },
    ],
  });

  return result;
};

export const PaymentServices = {
  paymentSuccessIntoDB,
  validatePaymentFromDB,
  allSuccessPaymentsFromDB,
};
