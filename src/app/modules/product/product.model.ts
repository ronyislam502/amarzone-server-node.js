import { Schema, model } from "mongoose";
import { TCreatedBy, TProduct } from "./product.interface";
import { USER_ROLE } from "../../interface/common";

const createdBySchema = new Schema<TCreatedBy>(
    {
        name: { type: String, required: true },
        role: {
            type: String,
            enum: Object.values(USER_ROLE),
            required: true,
        },
    },
    { _id: false }
);

const productSchema = new Schema<TProduct>(
    {
        author: { type: createdBySchema, required: true },
        department: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        title: {
            type: String,
            required: true
        },
        features: {
            type: [String],
            required: true
        },
        thumbnail: {
            type: String,
            default: "",
        },
        brand: {
            type: String,
            required: true
        },
        variants: [
            {
                type: Schema.Types.ObjectId,
                ref: "Variant",
            },
        ],
        tags: [{
            type: String,
            required: true
        }],
        isBestSeller: {
            type: Boolean,
            default: false
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
    },
    {
        timestamps: true,
    }
);

export const Product = model<TProduct>("Product", productSchema);
