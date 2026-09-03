import { z } from "zod";
import { CONVERSATION_TYPE } from "./conversation.interface";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createConversationZodSchema = z.object({
  body: z.object({
    participants: z
      .array(
        z.string().regex(objectIdRegex, "Invalid participant ID format")
      )
      .min(1, "At least one participant is required"),
    conversationType: z.enum(
      Object.keys(CONVERSATION_TYPE) as [string, ...string[]],
      {
        required_error: "Conversation type is required",
      }
    ),
    order: z
      .string()
      .regex(objectIdRegex, "Invalid order ID format")
      .optional(),
    dispute: z
      .string()
      .regex(objectIdRegex, "Invalid dispute ID format")
      .optional(),
  }),
});

export const ConversationValidations = {
  createConversationZodSchema,
};
