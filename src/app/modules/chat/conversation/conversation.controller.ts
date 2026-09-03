import httpStatus from "http-status";
import catchAsync from "../../../utilities/catchAsync";
import sendResponse from "../../../utilities/sendResponse";
import { ConversationServices } from "./conversation.service";
import { getUserIdFromUserPayload } from "../chat.utils";

const createConversation = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await ConversationServices.createConversation(
    currentUserId,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation created successfully",
    data: result,
  });
});

const getUserConversations = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await ConversationServices.getUserConversations(currentUserId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User conversations retrieved successfully",
    data: result,
  });
});

const archiveConversation = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { conversationId } = req.params;
  const result = await ConversationServices.archiveConversation(
    currentUserId,
    conversationId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation archived",
    data: result,
  });
});

export const ConversationControllers = {
  createConversation,
  getUserConversations,
  archiveConversation,
};
