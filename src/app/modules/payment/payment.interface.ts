import { Types } from "mongoose";
import { PAYMENT_STATUS } from "../order/order.interface";

export type TPayment = {
  user: Types.ObjectId;
  order: Types.ObjectId;
  amount: number;
  transactionId: string;
  status: keyof typeof PAYMENT_STATUS;
};
