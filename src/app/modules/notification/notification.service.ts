import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Notification } from "./notification.model";
import { TNotification } from "./notification.interface";
import { emitNotification } from "../../socket/socket";
import QueryBuilder from "../../builder/queryBuilder";
import { JwtPayload } from "jsonwebtoken";
import { USER_ROLE } from "../../interface/common";
import { User } from "../user/user.model";

const createNotificationIntoDB = async (payload: Partial<TNotification>) => {
    const notification = await Notification.create(payload);

    // Broadcast using Socket.io
    const { recipientRole, recipientId, type, message } = payload;
    let room = "";

    if (recipientRole === USER_ROLE.ADMIN || recipientRole === USER_ROLE.SUPER_ADMIN) {
        room = "admin_dashboard";
    } else if (recipientRole === USER_ROLE.VENDOR && recipientId) {
        room = `vendor:${recipientId}`;
    } else if (recipientRole === USER_ROLE.CUSTOMER && recipientId) {
        room = `customer:${recipientId}`;
    }

    if (room) {
        try {
            const notifData = {
                notificationId: notification._id,
                _id: notification._id,
                message,
                type,
                recipientRole,
                recipientId,
                relatedId: notification.relatedId,
                createdAt: notification.createdAt,
            };

            emitNotification(room, type as string, notifData);

            if (room === "admin_dashboard") {
                emitNotification("ADMIN", type as string, notifData);
            }
        } catch (error) {
            console.error(`[Notification Service] Failed to emit Socket.io event to room ${room}:`, error);
        }
    }

    return notification;
};

const getMyNotificationsFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const filter: Record<string, any> = { isDeleted: false };

    if (isUserExists.role === USER_ROLE.ADMIN || isUserExists.role === USER_ROLE.SUPER_ADMIN) {
        filter.$or = [
            { recipientRole: USER_ROLE.ADMIN },
            { recipientRole: USER_ROLE.SUPER_ADMIN },
            { recipientId: isUserExists._id },
        ];
    } else {
        filter.recipientId = isUserExists._id;
        filter.recipientRole = isUserExists.role;
    }

    const notificationQuery = new QueryBuilder(Notification.find(filter), query)
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await notificationQuery.countTotal();
    const data = await notificationQuery.modelQuery;

    return {
        meta,
        data,
    };
};

const markNotificationAsReadIntoDB = async (user: JwtPayload, notificationId: string) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
        throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
    }

    if (notification.recipientRole !== USER_ROLE.ADMIN && notification.recipientRole !== USER_ROLE.SUPER_ADMIN) {
        if (notification.recipientId?.toString() !== isUserExists._id?.toString()) {
            throw new AppError(httpStatus.FORBIDDEN, "You do not have permission to mark this notification as read");
        }
    }

    notification.isRead = true;
    await notification.save();

    return notification;
};

export const NotificationServices = {
    createNotificationIntoDB,
    getMyNotificationsFromDB,
    markNotificationAsReadIntoDB,
};
