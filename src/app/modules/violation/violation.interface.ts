import { Types } from "mongoose";
import { SLA_SEVERITY } from "../../interface/common";

export interface IViolation {
    vendor: Types.ObjectId;
    metric: string;
    actualValue: number;
    severity: typeof SLA_SEVERITY[keyof typeof SLA_SEVERITY];
    isResolved: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export type ISlaViolation = IViolation;