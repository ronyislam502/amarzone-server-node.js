import { z } from "zod";
import { CONVERSATION_TYPE, MESSAGE_TYPE } from "./chat.interface";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const attachmentValidationSchema = z.object({
  url: z.string({ required_error: "Attachment URL is required" }).url("Invalid URL format"),
  type: z.string({ required_error: "Attachment type is required" }),
  fileName: z.string({ required_error: "Attachment file name is required" }),
  size: z.number({ required_error: "Attachment size is required" }).nonnegative(),
});

const createConversationZodSchema = z.object({
  body: z.object({
    participants: z.array(z.string().regex(objectIdRegex, "Invalid participant ID format")).min(1, "At least one participant is required"),
    conversationType: z.enum(Object.keys(CONVERSATION_TYPE) as [string, ...string[]], {
      required_error: "Conversation type is required",
    }),
    order: z.string().regex(objectIdRegex, "Invalid order ID format").optional(),
    dispute: z.string().regex(objectIdRegex, "Invalid dispute ID format").optional(),
  }),
});

const sendMessageZodSchema = z.object({
  body: z.object({
    conversation: z.string().regex(objectIdRegex, "Invalid conversation ID format"),
    message: z.string().optional(),
    attachments: z.array(attachmentValidationSchema).optional(),
    messageType: z.enum(Object.keys(MESSAGE_TYPE) as [string, ...string[]], {
      required_error: "Message type is required",
    }),
  }).refine((data) => data.message || (data.attachments && data.attachments.length > 0), {
    message: "Either message text or at least one attachment must be provided",
    path: ["message"],
  }),
});

export const ChatValidations = {
  createConversationZodSchema,
  sendMessageZodSchema,
};
