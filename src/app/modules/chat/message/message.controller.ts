import httpStatus from "http-status";
import catchAsync from "../../../utilities/catchAsync";
import sendResponse from "../../../utilities/sendResponse";
import { MessageServices } from "./message.service";
import { getUserIdFromUserPayload } from "../chat.utils";

const getConversationMessages = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { conversationId } = req.params;
  const result = await MessageServices.getConversationMessages(
    currentUserId,
    conversationId,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation messages retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const sendMessage = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await MessageServices.sendMessage(currentUserId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const markMessagesAsRead = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { conversationId } = req.params;
  const result = await MessageServices.markMessagesAsRead(
    currentUserId,
    conversationId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages marked as read",
    data: result,
  });
});

const deleteMessage = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { messageId } = req.params;
  const result = await MessageServices.deleteMessage(currentUserId, messageId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message soft deleted successfully",
    data: result,
  });
});

export const MessageControllers = {
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
};
