import { Types } from "mongoose";
import { PAYMENT_STATUS } from "../../interface/common";

export interface TPayment {
  orderId: Types.ObjectId;
  transactionId: string;
  amount: number;
  currency: string;
  status: keyof typeof PAYMENT_STATUS;
  receiptUrl?: string;
  stripeEventId?: string;
  paymentGatewayData?: Record<string, any>;
}

export interface IProcessedEvent {
  eventId: string;
  createdAt: Date;
}
