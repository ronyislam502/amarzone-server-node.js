import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { NotificationServices } from "./notification.service";

const getMyNotifications = catchAsync(async (req, res) => {
    const result = await NotificationServices.getMyNotificationsFromDB(req.user, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Notifications retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const markAsRead = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await NotificationServices.markNotificationAsReadIntoDB(req.user, id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Notification marked as read successfully",
        data: result,
    });
});

export const NotificationControllers = {
    getMyNotifications,
    markAsRead,
};
