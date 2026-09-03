import { Types } from "mongoose";
import { TMessageType } from "../message/message.interface";

export const CONVERSATION_TYPE = {
  NORMAL: "NORMAL",
  ORDER: "ORDER",
  DISPUTE: "DISPUTE",
  SUPPORT: "SUPPORT",
} as const;

export type TConversationType = keyof typeof CONVERSATION_TYPE;

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
