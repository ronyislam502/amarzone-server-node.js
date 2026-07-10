import { model, Schema } from "mongoose";
import { TDateRange, TOrder } from "./order.interface";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

export const dateRangeSchema = new Schema<TDateRange>(
    {
        from: {
            type: Date,
            required: true,
        },
        to: {
            type: Date,
            required: true,
        },
    },
    {
        _id: false,
    }
);


const orderSchema = new Schema<TOrder>(
    {
        customer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        vendor: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true,
        },

        orderNo: {
            type: String,
            required: true,
            unique: true,
            trim: true,
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

        commission: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        tax: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        totalPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        totalQuantity: {
            type: Number,
            required: true,
            min: 1,
        },
        grandAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        shippedDate: {
            type: dateRangeSchema,
            required: true,
        },
        deliveryDate: {
            type: dateRangeSchema,
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(ORDER_STATUS),
            default: ORDER_STATUS.PENDING,
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.UNPAID,
            required: true,
        },
        transactionId: {
            type: String,
            required: true,
            trim: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

orderSchema.pre("find", function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

orderSchema.pre("findOne", function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

orderSchema.pre("aggregate", function (next) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
    next();
});


export const Order = model<TOrder>(
    "Order",
    orderSchema
);
