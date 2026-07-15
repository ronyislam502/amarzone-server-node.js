import { Types } from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

export type TTracking = {
    trackingNumber: string;
    courierName: string;
    shippedBy?: Types.ObjectId; // Admin/Vendor
    shippedAt?: Date;
    estimatedDelivery?: Date;
    deliveredAt?: Date;
    notes?: string;
};

export type TDateRange = {
    from: Date;
    to: Date;
};

export type TOrder = {
    customer: Types.ObjectId;
    vendor: Types.ObjectId;
    orderNo: string;
    products: { product: Types.ObjectId; quantity: number }[];
    commission: number;
    tax: number;
    totalPrice: number;
    totalQuantity: number;
    grandAmount: number;
    shippedDate: TDateRange;
    deliveryDate: TDateRange;
    status: keyof typeof ORDER_STATUS;
    paymentStatus: keyof typeof PAYMENT_STATUS;
    transactionId: string;
    tracking?: TTracking;
    isDeleted: boolean;
};