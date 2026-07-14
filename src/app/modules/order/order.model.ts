import mongoose, { model, Schema } from "mongoose";
import { TDateRange, TOrder, TTracking } from "./order.interface";
import { ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";

const courierSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        logo: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

export const Courier = mongoose.models.Courier || model("Courier", courierSchema);

export const trackingSchema = new Schema<TTracking>(
    {
        trackingNumber: {
            type: String,
            required: true,
            trim: true,
        },
        courier: {
            type: Schema.Types.ObjectId,
            ref: "Courier",
            required: true,
        },
        shippedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        shippedAt: {
            type: Date,
            required: false,
        },
        estimatedDelivery: {
            type: Date,
            required: false,
        },
        deliveredAt: {
            type: Date,
            required: false,
        },
        notes: {
            type: String,
            trim: true,
            required: false,
        },
    },
    {
        _id: false,
    }
);


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
            ref: "User",
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
        tracking: {
            type: trackingSchema,
            required: false,
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


orderSchema.post("save", async function (doc) {
    if (doc.vendor) {
        try {
            const { AccountHealthServices } = await import("../health/health.service");
            await AccountHealthServices.calculateVendorHealth(doc.vendor.toString());
        } catch (error) {
            console.error(`[Order Schema Post Save Hook] Failed to recalculate vendor health for ${doc.vendor}:`, error);
        }
    }
});

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
orderSchema.post(["findOneAndUpdate", "updateOne", "updateMany"], async function (this: any, doc) {
    let vendorId = doc?.vendor;
    if (!vendorId) {
        try {
            const filter = this.getFilter ? this.getFilter() : {};
            const OrderModel = this.model;
            const orderDoc = await OrderModel.findOne(filter);
            vendorId = orderDoc?.vendor;
        } catch (err) {
            // Ignore if we can't retrieve
        }
    }

    if (vendorId) {
        try {
            const { AccountHealthServices } = await import("../health/health.service");
            await AccountHealthServices.calculateVendorHealth(vendorId.toString());
        } catch (error) {
            console.error(`[Order Schema Post Update Hook] Failed to recalculate vendor health for ${vendorId}:`, error);
        }
    }
});

export const Order = model<TOrder>(
    "Order",
    orderSchema
);
