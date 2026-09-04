import { Types } from "mongoose";

export type TNotificationType = 
    | "NEW_ACCOUNT" 
    | "NEW_ORDER" 
    | "ORDER_DELIVERED"
    | "ORDER_SHIPPED";

export type TNotification = {
    recipientRole: string; // "ADMIN", "VENDOR", "CUSTOMER"
    recipientId?: Types.ObjectId; // Nullable if for all admins
    type: TNotificationType;
    message: string;
    isRead: boolean;
    relatedId?: Types.ObjectId; // E.g., order ID, user ID
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
};
