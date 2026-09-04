import { Server, Socket } from "socket.io";
import httpStatus from "http-status";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import config from "../config";
import AppError from "../errors/AppError";
import { User } from "../modules/user/user.model";
import { ConversationServices } from "../modules/chat/conversation/conversation.service";
import { MessageServices } from "../modules/chat/message/message.service";
import { Conversation } from "../modules/chat/conversation/conversation.model";
import { checkConversationParticipant } from "../utilities/chat";
import { sendSocketResponse } from "./socketResponse";
import { ConversationValidations } from "../modules/chat/conversation/conversation.validation";
import { MessageValidations } from "../modules/chat/message/message.validation";

type TSocketUser = {
  _id: Types.ObjectId;
  email: string;
  role: string;
};

/**
 * Resolves the authenticated user from socket.data, handshake, or payload data.
 */
export const getSocketUser = async (
  socket: Socket,
  data?: any
): Promise<TSocketUser> => {
  // 1. Cached on socket.data
  if (socket.data?.user?._id) {
    return socket.data.user;
  }

  // 2. Extract token from handshake or data payload
  const rawToken =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization ||
    data?.token;

  if (rawToken) {
    try {
      const token = rawToken.startsWith("Bearer ")
        ? rawToken.slice(7)
        : rawToken;

      const decoded = jwt.verify(
        token,
        config.access_token_secret as string
      ) as JwtPayload;

      const user = await User.findOne({ email: decoded.email, isDeleted: false });
      if (user) {
        socket.data.user = { _id: user._id, email: user.email, role: user.role };
        socket.join(user._id.toString());
        return socket.data.user;
      }
    } catch {
      // invalid token, try fallback
    }
  }

  // 3. Fallback: userId passed directly in payload
  if (data?.userId) {
    const user = await User.findOne({ _id: data.userId, isDeleted: false });
    if (user) {
      socket.data.user = { _id: user._id, email: user.email, role: user.role };
      socket.join(user._id.toString());
      return socket.data.user;
    }
  }

  // 4. Fallback: userEmail passed directly in payload
  if (data?.userEmail) {
    const user = await User.findOne({ email: data.userEmail, isDeleted: false });
    if (user) {
      socket.data.user = { _id: user._id, email: user.email, role: user.role };
      socket.join(user._id.toString());
      return socket.data.user;
    }
  }

  throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized socket request");
};

export const chatSocket = (io: Server, socket: Socket) => {
  // Automatically authenticate if token is in handshake
  getSocketUser(socket).catch(() => {
    // Client can authenticate later with "authenticate" event
  });

  // ==========================================
  // AUTHENTICATE / JOIN PERSONAL ROOM
  // ==========================================
  socket.on("authenticate", async (data, callback) => {
    try {
      const user = await getSocketUser(socket, data);

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Socket authenticated successfully",
        data: { userId: user._id, email: user.email, role: user.role },
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.UNAUTHORIZED,
        success: false,
        message: error?.message || "Authentication failed",
        data: null,
      });
    }
  });

  // ==========================================
  // CONVERSATION: CREATE CONVERSATION
  // ==========================================
  const handleCreateConversation = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);

      const payload = data?.body || data;
      ConversationValidations.createConversationZodSchema.parse({
        body: payload,
      });

      const result = await ConversationServices.createConversation(
        user._id,
        payload
      );

      // Notify all participants about the new conversation
      if (result && Array.isArray(result.participants)) {
        result.participants.forEach((participant: any) => {
          const participantId = participant._id
            ? participant._id.toString()
            : participant.toString();
          io.to(participantId).emit("new_conversation", result);
          io.to(participantId).emit("newConversation", result);
        });
      }

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Conversation created successfully",
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to create conversation",
        data: null,
      });
    }
  };

  socket.on("createConversation", handleCreateConversation);
  socket.on("create_conversation", handleCreateConversation);

  // ==========================================
  // CONVERSATION: GET USER CONVERSATIONS
  // ==========================================
  const handleGetUserConversations = async (data: any, callback: any) => {
    try {
      // Support callback as first argument if data was omitted
      const cb = typeof data === "function" ? data : callback;
      const payload = typeof data === "function" ? {} : data;

      const user = await getSocketUser(socket, payload);
      const result = await ConversationServices.getUserConversations(user._id);

      sendSocketResponse(cb, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Conversations retrieved successfully",
        data: result,
      });
    } catch (error: any) {
      const cb = typeof data === "function" ? data : callback;
      sendSocketResponse(cb, {
        statusCode: error?.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: error?.message || "Failed to retrieve conversations",
        data: null,
      });
    }
  };

  socket.on("getUserConversations", handleGetUserConversations);
  socket.on("get_user_conversations", handleGetUserConversations);
  socket.on("getConversations", handleGetUserConversations);

  // ==========================================
  // CONVERSATION: ARCHIVE CONVERSATION
  // ==========================================
  const handleArchiveConversation = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId;

      if (!conversationId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Conversation ID is required"
        );
      }

      const result = await ConversationServices.archiveConversation(
        user._id,
        conversationId
      );

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to archive conversation",
        data: null,
      });
    }
  };

  socket.on("archiveConversation", handleArchiveConversation);
  socket.on("archive_conversation", handleArchiveConversation);

  // ==========================================
  // ROOM: JOIN & LEAVE CONVERSATION ROOMS
  // ==========================================
  const handleJoinConversation = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId || data;

      if (!conversationId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Conversation ID is required"
        );
      }

      await checkConversationParticipant(conversationId, user._id);
      socket.join(conversationId.toString());

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Joined conversation room successfully",
        data: { conversationId },
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to join conversation room",
        data: null,
      });
    }
  };

  socket.on("joinConversation", handleJoinConversation);
  socket.on("join_conversation", handleJoinConversation);

  const handleLeaveConversation = async (data: any, callback: any) => {
    try {
      const conversationId = data?.conversationId || data;
      if (conversationId) {
        socket.leave(conversationId.toString());
      }

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Left conversation room successfully",
        data: { conversationId },
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to leave conversation room",
        data: null,
      });
    }
  };

  socket.on("leaveConversation", handleLeaveConversation);
  socket.on("leave_conversation", handleLeaveConversation);

  // ==========================================
  // MESSAGE: SEND MESSAGE
  // ==========================================
  const handleSendMessage = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const payload = data?.body || data;

      MessageValidations.sendMessageZodSchema.parse({ body: payload });

      const result = await MessageServices.sendMessage(user._id, payload);

      const conversationId = payload.conversation.toString();

      // 1. Broadcast in real-time to everyone in the conversation room
      io.to(conversationId).emit("new_message", result);
      io.to(conversationId).emit("newMessage", result);

      // 2. Also emit to participant personal rooms so inactive chats/badges update
      const conversation = await Conversation.findById(conversationId);
      if (conversation && Array.isArray(conversation.participants)) {
        conversation.participants.forEach((pId) => {
          io.to(pId.toString()).emit("new_message", result);
          io.to(pId.toString()).emit("newMessage", result);
        });
      }

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Message sent successfully",
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to send message",
        data: null,
      });
    }
  };

  socket.on("sendMessage", handleSendMessage);
  socket.on("send_message", handleSendMessage);

  // ==========================================
  // MESSAGE: GET CONVERSATION MESSAGES
  // ==========================================
  const handleGetMessages = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId;

      if (!conversationId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Conversation ID is required"
        );
      }

      const query = data?.query || {};
      const result = await MessageServices.getConversationMessages(
        user._id,
        conversationId,
        query
      );

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Messages retrieved successfully",
        data: result.data,
        meta: result.meta,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to retrieve messages",
        data: null,
      });
    }
  };

  socket.on("getConversationMessages", handleGetMessages);
  socket.on("get_conversation_messages", handleGetMessages);
  socket.on("getMessages", handleGetMessages);
  socket.on("get_messages", handleGetMessages);

  // ==========================================
  // MESSAGE: MARK MESSAGES AS READ
  // ==========================================
  const handleMarkMessagesAsRead = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId;

      if (!conversationId) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Conversation ID is required"
        );
      }

      const result = await MessageServices.markMessagesAsRead(
        user._id,
        conversationId
      );

      // Real-time broadcast that messages have been read
      io.to(conversationId.toString()).emit("messages_read", {
        conversationId,
        readBy: user._id,
        readAt: new Date(),
      });
      io.to(conversationId.toString()).emit("messagesRead", {
        conversationId,
        readBy: user._id,
        readAt: new Date(),
      });

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to mark messages as read",
        data: null,
      });
    }
  };

  socket.on("markMessagesAsRead", handleMarkMessagesAsRead);
  socket.on("mark_messages_read", handleMarkMessagesAsRead);
  socket.on("markAsRead", handleMarkMessagesAsRead);

  // ==========================================
  // MESSAGE: DELETE MESSAGE
  // ==========================================
  const handleDeleteMessage = async (data: any, callback: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const messageId = data?.messageId;

      if (!messageId) {
        throw new AppError(httpStatus.BAD_REQUEST, "Message ID is required");
      }

      const result = await MessageServices.deleteMessage(user._id, messageId);

      // Real-time broadcast that a message was deleted
      const conversationId = data?.conversationId;
      if (conversationId) {
        io.to(conversationId.toString()).emit("message_deleted", {
          messageId,
          conversationId,
        });
        io.to(conversationId.toString()).emit("messageDeleted", {
          messageId,
          conversationId,
        });
      } else {
        io.emit("message_deleted", { messageId });
        io.emit("messageDeleted", { messageId });
      }

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.BAD_REQUEST,
        success: false,
        message: error?.message || "Failed to delete message",
        data: null,
      });
    }
  };

  socket.on("deleteMessage", handleDeleteMessage);
  socket.on("delete_message", handleDeleteMessage);

  // ==========================================
  // TYPING INDICATORS
  // ==========================================
  socket.on("typing", async (data: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.to(conversationId.toString()).emit("user_typing", {
          conversationId,
          userId: user._id,
        });
        socket.to(conversationId.toString()).emit("userTyping", {
          conversationId,
          userId: user._id,
        });
      }
    } catch {
      // ignore typing error
    }
  });

  socket.on("stop_typing", async (data: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.to(conversationId.toString()).emit("user_stop_typing", {
          conversationId,
          userId: user._id,
        });
        socket.to(conversationId.toString()).emit("userStoppedTyping", {
          conversationId,
          userId: user._id,
        });
      }
    } catch {
      // ignore stop_typing error
    }
  });

  socket.on("stopTyping", async (data: any) => {
    try {
      const user = await getSocketUser(socket, data);
      const conversationId = data?.conversationId;
      if (conversationId) {
        socket.to(conversationId.toString()).emit("user_stop_typing", {
          conversationId,
          userId: user._id,
        });
        socket.to(conversationId.toString()).emit("userStoppedTyping", {
          conversationId,
          userId: user._id,
        });
      }
    } catch {
      // ignore stopTyping error
    }
  });
};
