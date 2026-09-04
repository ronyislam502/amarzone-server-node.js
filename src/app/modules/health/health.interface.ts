import { Types } from "mongoose";
import { VENDOR_HEALTH } from "../../interface/common";

export interface IAccountHealth {
    vendor: Types.ObjectId;
    orderDefectRate: number; // percentage (e.g., 2 for 2%)
    lateShipmentRate: number; // percentage
    cancellationRate: number; // percentage
    validTrackingRate: number; // percentage (e.g., 98 for 98%)
    score: number; // 0 - 1000
    status: keyof typeof VENDOR_HEALTH;
    calculatedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}