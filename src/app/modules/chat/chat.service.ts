import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Conversation, Message } from "./chat.model";
import { TConversation, TMessage } from "./chat.interface";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { checkConversationParticipant } from "./chat.utils";

const createConversation = async (
  currentUserId: Types.ObjectId,
  payload: Partial<TConversation>
) => {
  const { participants, conversationType, order, dispute } = payload;

  if (!participants || !participants.length) {
    throw new AppError(httpStatus.BAD_REQUEST, "Participants are required");
  }

  // Ensure current user is in participants
  const participantStrings = participants.map((id) => id.toString());
  if (!participantStrings.includes(currentUserId.toString())) {
    participants.push(currentUserId);
  }

  // Prevent duplicate direct chats (NORMAL conversationType)
  if (conversationType === "NORMAL" && participants.length === 2) {
    const existingChat = await Conversation.findOne({
      conversationType: "NORMAL",
      participants: { $all: participants },
      isDeleted: false,
    }).populate("participants", "name email role status");

    if (existingChat) {
      return existingChat;
    }
  }

  // Prevent duplicate chats for ORDER
  if (conversationType === "ORDER" && order) {
    const existingOrderChat = await Conversation.findOne({
      conversationType: "ORDER",
      order,
      isDeleted: false,
    }).populate("participants", "name email role status");

    if (existingOrderChat) {
      return existingOrderChat;
    }
  }

  // Prevent duplicate chats for DISPUTE
  if (conversationType === "DISPUTE" && dispute) {
    const existingDisputeChat = await Conversation.findOne({
      conversationType: "DISPUTE",
      dispute,
      isDeleted: false,
    }).populate("participants", "name email role status");

    if (existingDisputeChat) {
      return existingDisputeChat;
    }
  }

  // Create new conversation
  const newConversation = await Conversation.create({
    participants,
    conversationType,
    order,
    dispute,
    archivedBy: [],
    isDeleted: false,
  });

  return await Conversation.findById(newConversation._id).populate(
    "participants",
    "name email role status"
  );
};

const getUserConversations = async (userId: Types.ObjectId) => {
  const conversations = await Conversation.find({
    participants: userId,
    archivedBy: { $ne: userId },
    isDeleted: false,
  })
    .populate("participants", "name email role status")
    .populate("order")
    .populate("dispute")
    .populate("lastMessage")
    .populate("lastMessageSender", "name email role")
    .sort({ lastMessageAt: -1, updatedAt: -1 });

  const conversationList = [];

  for (const conv of conversations) {
    // Calculate unread count dynamically
    const unreadCount = await Message.countDocuments({
      conversation: conv._id,
      sender: { $ne: userId },
      status: { $ne: "READ" },
      isDeleted: false,
    });

    conversationList.push({
      ...conv.toObject(),
      unreadCount,
    });
  }

  return conversationList;
};

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
  const data = await messageQuery.modelQuery.populate("sender", "name email role");

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

const archiveConversation = async (
  userId: Types.ObjectId,
  conversationId: string
) => {
  // Verify participant
  await checkConversationParticipant(conversationId, userId);

  // Add user to archivedBy array if not already present
  await Conversation.findByIdAndUpdate(conversationId, {
    $addToSet: { archivedBy: userId },
  });

  return { message: "Conversation archived successfully" };
};

const deleteMessage = async (
  userId: Types.ObjectId,
  messageId: string
) => {
  const messageObj = await Message.findOne({ _id: messageId, isDeleted: false });

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

export const ChatServices = {
  createConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  archiveConversation,
  deleteMessage,
};
