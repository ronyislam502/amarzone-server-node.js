import { Router } from "express";
import auth from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { USER_ROLE } from "../../../interface/common";
import { MessageControllers } from "./message.controller";
import { MessageValidations } from "./message.validation";

const router = Router();

router.post(
  "/",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  validateRequest(MessageValidations.sendMessageZodSchema),
  MessageControllers.sendMessage
);

router.get(
  "/:conversationId",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  MessageControllers.getConversationMessages
);

router.patch(
  "/:conversationId/read",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  MessageControllers.markMessagesAsRead
);

router.delete(
  "/:messageId",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  MessageControllers.deleteMessage
);

export const MessageRoutes = router;
