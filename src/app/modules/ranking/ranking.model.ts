import { Schema, model } from "mongoose";
import { IRanking } from "./ranking.interface";

const rankingSchema = new Schema<IRanking>(
    {
        variant: {
            type: Schema.Types.ObjectId,
            ref: "Variant",
            required: true,
            unique: true,
            index: true,
        },
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true,
        },
        asin: {
            type: String,
            required: true,
            index: true,
        },
        department: {
            type: Schema.Types.ObjectId,
            ref: "Department",
            required: true,
            index: true,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
            index: true,
        },
        globalRank: {
            type: Number,
            required: true,
            default: 0,
            index: true,
        },
        departmentRank: {
            type: Number,
            required: true,
            default: 0,
            index: true,
        },
        categoryRank: {
            type: Number,
            required: true,
            default: 0,
            index: true,
        },
        salesScore: {
            type: Number,
            required: true,
            default: 0,
        },
        totalSalesCount: {
            type: Number,
            required: true,
            default: 0,
        },
        recentSalesCount: {
            type: Number,
            required: true,
            default: 0,
        },
        isBestSeller: {
            type: Boolean,
            default: false,
            index: true,
        },
        calculatedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

rankingSchema.index({ globalRank: 1 });
rankingSchema.index({ department: 1, departmentRank: 1 });
rankingSchema.index({ category: 1, categoryRank: 1 });
rankingSchema.index({ product: 1, variant: 1 });

export const Ranking = model<IRanking>("Ranking", rankingSchema);
