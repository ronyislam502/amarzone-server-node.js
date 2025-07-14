import { model, Schema } from "mongoose";
import { ORDER_STATUS, PAYMENT_STATUS, TOrder } from "./order.interface";

const OrderSchema = new Schema<TOrder>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Customer",
    },
    orderNo: {
      type: String,
      required: true,
      unique: true,
    },
    products: [
      {
        product: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],
    tax: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
    },
    grandAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.keys(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    paymentStatus: {
      type: String,
      enum: Object.keys(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = model<TOrder>("Order", OrderSchema);
