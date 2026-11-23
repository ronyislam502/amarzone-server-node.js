import { Types } from "mongoose";

export interface IRanking {
    variant: Types.ObjectId;
    product: Types.ObjectId;
    asin: string;
    department: Types.ObjectId;
    category: Types.ObjectId;
    globalRank: number; // Rank across the entire marketplace (e.g. #5 in the entire marketplace)
    departmentRank: number; // Rank within department (e.g. #1 in Electronics)
    categoryRank: number; // Rank within category (e.g. #2 in Smartphones)
    salesScore: number;
    totalSalesCount: number;
    recentSalesCount: number;
    isBestSeller: boolean;
    calculatedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
