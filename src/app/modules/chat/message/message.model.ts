import { Schema, model } from "mongoose";
import {
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  TMessage,
  TMessageAttachment,
} from "./message.interface";

export const attachmentSchema = new Schema<TMessageAttachment>(
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

export const Message = model<TMessage>("Message", messageSchema);
