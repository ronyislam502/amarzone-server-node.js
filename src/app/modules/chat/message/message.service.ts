import httpStatus from "http-status";
import AppError from "../../../errors/AppError";
import { Message } from "./message.model";
import { TMessage } from "./message.interface";
import { Types } from "mongoose";
import QueryBuilder from "../../../builder/queryBuilder";
import { checkConversationParticipant } from "../../../utilities/chat";
import { Conversation } from "../conversation/conversation.model";

const getConversationMessages = async (
  userId: Types.ObjectId,
  conversationId: string,
  query: Record<string, unknown>
) => {
  // Verify participant
  await checkConversationParticipant(conversationId, userId);

  const messageQuery = new QueryBuilder(
    Message.find({ conversation: conversationId, isDeleted: false }),
    query
  )
    .search(["message"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await messageQuery.countTotal();
  const data = await messageQuery.modelQuery.populate(
    "sender",
    "name email role"
  );

  return { meta, data };
};

const sendMessage = async (
  senderId: Types.ObjectId,
  payload: Partial<TMessage>
) => {
  const { conversation, message, attachments, messageType } = payload;

  if (!conversation) {
    throw new AppError(httpStatus.BAD_REQUEST, "Conversation ID is required");
  }

  // Verify sender is participant
  await checkConversationParticipant(conversation, senderId);

  // Save the message in DB
  const newMessage = await Message.create({
    conversation,
    sender: senderId,
    message,
    attachments,
    messageType,
    status: "SENT",
    isDeleted: false,
  });

  // Update conversation info and clear archives (so it becomes active again)
  await Conversation.findByIdAndUpdate(conversation, {
    lastMessage: newMessage._id,
    lastMessageSender: senderId,
    lastMessageType: messageType,
    lastMessageAt: newMessage.createdAt || new Date(),
    archivedBy: [], // Clear archivedBy so conversation reappears for everyone
  });

  const populatedMessage = await Message.findById(newMessage._id).populate(
    "sender",
    "name email role"
  );

  return populatedMessage;
};

const markMessagesAsRead = async (
  userId: Types.ObjectId,
  conversationId: string
) => {
  // Verify participant
  await checkConversationParticipant(conversationId, userId);

  // Update messages sent by others in this conversation to READ
  await Message.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: userId },
      status: { $ne: "READ" },
    },
    {
      $set: {
        status: "READ",
        readAt: new Date(),
      },
    }
  );

  return { message: "Messages marked as read successfully" };
};

const deleteMessage = async (userId: Types.ObjectId, messageId: string) => {
  const messageObj = await Message.findOne({
    _id: messageId,
    isDeleted: false,
  });

  if (!messageObj) {
    throw new AppError(httpStatus.NOT_FOUND, "Message not found");
  }

  // Only the sender can delete their message
  if (messageObj.sender.toString() !== userId.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this message"
    );
  }

  // Soft delete message
  messageObj.isDeleted = true;
  await messageObj.save();

  // If this was the last message, update the conversation reference if needed
  const conversation = await Conversation.findOne({ lastMessage: messageId });
  if (conversation) {
    // Find the previous active message in the conversation
    const prevMessage = await Message.findOne({
      conversation: conversation._id,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    if (prevMessage) {
      conversation.lastMessage = prevMessage._id;
      conversation.lastMessageSender = prevMessage.sender;
      conversation.lastMessageType = prevMessage.messageType;
      conversation.lastMessageAt = prevMessage.createdAt;
    } else {
      conversation.lastMessage = undefined;
      conversation.lastMessageSender = undefined;
      conversation.lastMessageType = undefined;
      conversation.lastMessageAt = undefined;
    }
    await conversation.save();
  }

  return { message: "Message deleted successfully (soft delete)" };
};

export const MessageServices = {
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
};
