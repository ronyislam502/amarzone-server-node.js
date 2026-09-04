import { model, Schema } from "mongoose";
import { TNotification } from "./notification.interface";
import { USER_ROLE } from "../../interface/common";

const notificationSchema = new Schema<TNotification>(
    {
        recipientRole: {
            type: String,
            enum: Object.values(USER_ROLE),
            required: true,
        },
        recipientId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        type: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        relatedId: {
            type: Schema.Types.ObjectId,
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

export const Notification = model<TNotification>("Notification", notificationSchema);
