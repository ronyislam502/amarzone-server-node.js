import httpStatus from "http-status";
import AppError from "../../../errors/AppError";
import { Conversation } from "./conversation.model";
import { Message } from "../message/message.model";
import { TConversation } from "./conversation.interface";
import { Types } from "mongoose";
import { checkConversationParticipant } from "../../../utilities/chat";

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

export const ConversationServices = {
  createConversation,
  getUserConversations,
  archiveConversation,
};
