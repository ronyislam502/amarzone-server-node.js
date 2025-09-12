import { Types } from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

export type TOrder = {
  customer: Types.ObjectId;
  shop: Types.ObjectId;
  orderNo: string;
  products: { product: Types.ObjectId; quantity: number }[];
  serviceFee: number;
  tax: number;
  totalPrice: number;
  totalQuantity: number;
  grandAmount: number;
  status: keyof typeof ORDER_STATUS;
  paymentStatus: keyof typeof PAYMENT_STATUS;
  transactionId: string;
};
