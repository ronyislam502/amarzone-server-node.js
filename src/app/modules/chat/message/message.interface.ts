import { Types } from "mongoose";

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
