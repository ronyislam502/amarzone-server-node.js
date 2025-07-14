import { Types } from "mongoose";

export const ORDER_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  UNSHIPPED: "UNSHIPPED",
  SHIPPED: "SHIPPED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
} as const;

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
