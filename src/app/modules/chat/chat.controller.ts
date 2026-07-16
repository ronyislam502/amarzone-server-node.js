import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ChatServices } from "./chat.service";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";

const getUserIdFromUserPayload = async (email: string) => {
  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Authenticated user not found");
  }
  return user._id;
};

const createConversation = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await ChatServices.createConversation(currentUserId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation created successfully",
    data: result,
  });
});

const getUserConversations = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await ChatServices.getUserConversations(currentUserId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User conversations retrieved successfully",
    data: result,
  });
});

const getConversationMessages = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { conversationId } = req.params;
  const result = await ChatServices.getConversationMessages(
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
  const result = await ChatServices.sendMessage(currentUserId, req.body);

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
  const result = await ChatServices.markMessagesAsRead(currentUserId, conversationId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages marked as read",
    data: result,
  });
});

const archiveConversation = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { conversationId } = req.params;
  const result = await ChatServices.archiveConversation(currentUserId, conversationId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation archived",
    data: result,
  });
});

const deleteMessage = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { messageId } = req.params;
  const result = await ChatServices.deleteMessage(currentUserId, messageId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message soft deleted successfully",
    data: result,
  });
});

export const ChatControllers = {
  createConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  archiveConversation,
  deleteMessage,
};
