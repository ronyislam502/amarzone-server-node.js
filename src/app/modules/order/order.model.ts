import { model, Schema } from "mongoose";
import { TOrder } from "./order.interface";

const OrderSchema = new Schema<TOrder>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    orderNo: {
      type: String,
      required: true,
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
      enum: {
        values: ["Pending", "unshipped", "Completed", "Cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["Unpaid", "Paid", "Refunded"],
        message: "{VALUE} is not a valid paymentStatus",
      },
      default: "Unpaid",
    },
    transactionId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = model<TOrder>("Order", OrderSchema);
