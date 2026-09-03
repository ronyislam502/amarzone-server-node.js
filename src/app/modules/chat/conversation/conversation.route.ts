import { Router } from "express";
import auth from "../../../middlewares/auth";
import { validateRequest } from "../../../middlewares/validateRequest";
import { USER_ROLE } from "../../../interface/common";
import { ConversationControllers } from "./conversation.controller";
import { ConversationValidations } from "./conversation.validation";

const router = Router();

router.post(
  "/",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  validateRequest(ConversationValidations.createConversationZodSchema),
  ConversationControllers.createConversation
);

router.get(
  "/",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  ConversationControllers.getUserConversations
);

router.patch(
  "/:conversationId/archive",
  auth(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.ADMIN,
    USER_ROLE.VENDOR,
    USER_ROLE.CUSTOMER
  ),
  ConversationControllers.archiveConversation
);

export const ConversationRoutes = router;
