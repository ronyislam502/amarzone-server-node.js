import { Schema, model } from "mongoose";
import {
  CONVERSATION_TYPE,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  TConversation,
  TMessage,
  TMessageAttachment,
} from "./chat.interface";

const attachmentSchema = new Schema<TMessageAttachment>(
  {
    url: { type: String, required: true },
    type: { type: String, required: true },
    fileName: { type: String, required: true },
    size: { type: Number, required: true },
  },
  {
    _id: false,
  }
);

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

const messageSchema = new Schema<TMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    messageType: {
      type: String,
      enum: Object.keys(MESSAGE_TYPE),
      required: true,
    },
    status: {
      type: String,
      enum: Object.keys(MESSAGE_STATUS),
      default: MESSAGE_STATUS.SENT,
      required: true,
    },
    readAt: {
      type: Date,
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

export const Conversation = model<TConversation>("Conversation", conversationSchema);
export const Message = model<TMessage>("Message", messageSchema);
