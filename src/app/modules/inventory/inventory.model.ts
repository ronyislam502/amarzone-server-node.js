import { model, Schema } from "mongoose";
import { TListProduct, TSeller } from "./inventory.interface";


const SellerSchema = new Schema<TSeller>({
    vendor: {
        type: Schema.Types.ObjectId,
        required: [true, "Vendor is required"],
        ref: "User",
    },
    price: {
        type: Number,
        required: [true, "price is required"],
    },
    quantity: {
        type: Number,
        required: [true, "quantity is required"],
    },
    isStock: {
        type: Boolean,
        default: true,
    },
    fulfillmentBy: {
        type: String,
        required: [true, "fulfillmentBy is required"],
    },
    shippingTime: {
        type: Number,
        required: [true, "shippingTime is required"],
    },
    isBuyBoxWinner: {
        type: Boolean,
        default: false,
    },
});

const listProductSchema = new Schema<TListProduct>(
    {
        product: {
            type: Schema.Types.ObjectId,
            required: [true, "product id is required"],
            ref: "Product",
        },
        asin: {
            type: String,
            required: [true, "ASIN is required"],
        },
        seller: {
            type: SellerSchema,
            required: [true, "Seller is required"],
        },
        isDeleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

listProductSchema.pre("find", function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

listProductSchema.pre("findOne", function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});

listProductSchema.pre("aggregate", function (next) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
    next();
});

export const ListProduct = model<TListProduct>(
    "ListProduct",
    listProductSchema
);