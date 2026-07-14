import { Types } from "mongoose";

export interface IViolation {
    vendor: Types.ObjectId;
    metric: string;
    actualValue: number;
    severity: "Warning" | "Suspension";
    isResolved: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export type ISlaViolation = IViolation;