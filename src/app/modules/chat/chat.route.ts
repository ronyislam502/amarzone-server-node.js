import { Router } from "express";
import auth from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validateRequest";

import { USER_ROLE } from "../../interface/common";
import { ChatControllers } from "./chat.controller";
import { ChatValidations } from "./chat.validation";

const router = Router();

// Secure all chat routes for authenticated users
router.use(
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  )
);

router.post(
  "/",
  validateRequest(ChatValidations.createConversationZodSchema),
  ChatControllers.createConversation
);

router.get("/", ChatControllers.getUserConversations);

router.get("/:conversationId/messages", ChatControllers.getConversationMessages);

router.post(
  "/messages",
  validateRequest(ChatValidations.sendMessageZodSchema),
  ChatControllers.sendMessage
);

router.patch("/:conversationId/read", ChatControllers.markMessagesAsRead);

router.patch("/:conversationId/archive", ChatControllers.archiveConversation);

router.delete("/messages/:messageId", ChatControllers.deleteMessage);

export const ChatRoutes = router;
