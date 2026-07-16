import { Types } from "mongoose";

export const CONVERSATION_TYPE = {
  NORMAL: "NORMAL",
  ORDER: "ORDER",
  DISPUTE: "DISPUTE",
  SUPPORT: "SUPPORT",
} as const;

export type TConversationType = keyof typeof CONVERSATION_TYPE;

export const MESSAGE_TYPE = {
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  FILE: "FILE",
} as const;

export type TMessageType = keyof typeof MESSAGE_TYPE;

export const MESSAGE_STATUS = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
} as const;

export type TMessageStatus = keyof typeof MESSAGE_STATUS;

export type TMessageAttachment = {
  url: string;
  type: string;
  fileName: string;
  size: number;
};

export type TConversation = {
  participants: Types.ObjectId[];
  conversationType: TConversationType;
  order?: Types.ObjectId;
  dispute?: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  lastMessageSender?: Types.ObjectId;
  lastMessageType?: TMessageType;
  lastMessageAt?: Date;
  archivedBy: Types.ObjectId[];
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TMessage = {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  message?: string;
  attachments?: TMessageAttachment[];
  messageType: TMessageType;
  status: TMessageStatus;
  readAt?: Date;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};
