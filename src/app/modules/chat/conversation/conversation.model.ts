import { Schema, model } from "mongoose";
import { CONVERSATION_TYPE, TConversation } from "./conversation.interface";
import { MESSAGE_TYPE } from "../message/message.interface";

const conversationSchema = new Schema<TConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    conversationType: {
      type: String,
      enum: Object.keys(CONVERSATION_TYPE),
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    dispute: {
      type: Schema.Types.ObjectId,
      ref: "Dispute",
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageSender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessageType: {
      type: String,
      enum: Object.keys(MESSAGE_TYPE),
    },
    lastMessageAt: {
      type: Date,
    },
    archivedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Conversation = model<TConversation>(
  "Conversation",
  conversationSchema
);
