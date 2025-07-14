import { Types } from "mongoose";

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
  status: "Pending" | "unshipped" | "Completed" | "Cancelled";
  paymentStatus: "Unpaid" | "Paid" | "Refunded";
  transactionId: string;
};
