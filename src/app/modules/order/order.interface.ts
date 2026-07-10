import { Types } from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

export type TDateRange = {
    from: Date;
    to: Date;
};

export type TOrder = {
    customer: Types.ObjectId;
    vendor: Types.ObjectId;
    orderNo: string;
    products: { product: Types.ObjectId; quantity: number }[];
    serviceFee: number;
    tax: number;
    totalPrice: number;
    totalQuantity: number;
    grandAmount: number;
    shippedDate: TDateRange;
    deliveryDate: TDateRange;
    status: keyof typeof ORDER_STATUS;
    paymentStatus: keyof typeof PAYMENT_STATUS;
    transactionId: string;
    isDeleted: boolean;
};