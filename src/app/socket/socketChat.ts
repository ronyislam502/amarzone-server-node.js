import { Server, Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import { User } from "../modules/user/user.model";
import { ChatServices } from "../modules/chat/chat.service";
import { Conversation } from "../modules/chat/chat.model";
import { checkConversationParticipant } from "../modules/chat/chat.utils";
import { Types } from "mongoose";

// Map to track online users: userId string -> socketId string
const onlineUsers = new Map<string, string>();

/**
 * Socket.io authentication middleware
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error("Authentication error. Token is missing."));
    }

    const decoded = jwt.verify(
      token,
      config.access_token_secret as string
    ) as JwtPayload;

    const user = await User.findOne({ email: decoded.email, isDeleted: false });
    if (!user) {
      return next(new Error("Authentication error. User not found."));
    }

    socket.data.user = {
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (err: any) {
    next(new Error(`Authentication error. ${err.message}`));
  }
};

/**
 * Registers all chat handlers on a client connection
 */
export const registerChatHandlers = (io: Server, socket: Socket) => {
  const user = socket.data.user;
  const userId = user._id.toString();

  // Track online status
  onlineUsers.set(userId, socket.id);
  
  // Join user's personal room for direct notification targetting
  socket.join(`user:${userId}`);

  // Broadcast user is online
  socket.broadcast.emit("userOnline", { userId });

  console.log(`[Socket Chat] User connected: ${userId} (${user.email})`);

  // Event: joinConversation
  socket.on("joinConversation", async ({ conversationId }: { conversationId: string }) => {
    try {
      if (!conversationId) return;

      // Verify the user is a participant of the conversation
      await checkConversationParticipant(conversationId, user._id);

      socket.join(conversationId);
      console.log(`[Socket Chat] User ${userId} joined room ${conversationId}`);
    } catch (error: any) {
      socket.emit("error", { message: error.message || "Failed to join conversation room" });
    }
  });

  // Event: leaveConversation
  socket.on("leaveConversation", ({ conversationId }: { conversationId: string }) => {
    if (!conversationId) return;
    socket.leave(conversationId);
    console.log(`[Socket Chat] User ${userId} left room ${conversationId}`);
  });

  // Event: sendMessage
  socket.on(
    "sendMessage",
    async ({
      conversationId,
      message,
      messageType,
      attachments,
    }: {
      conversationId: string;
      message?: string;
      messageType: "TEXT" | "IMAGE" | "VIDEO" | "FILE";
      attachments?: any[];
    }) => {
      try {
        if (!conversationId || !messageType) {
          socket.emit("error", { message: "conversationId and messageType are required" });
          return;
        }

        // Verify participant
        const conversation = await checkConversationParticipant(conversationId, user._id);

        // Save message in DB via ChatService
        const savedMessage = await ChatServices.sendMessage(user._id, {
          conversation: new Types.ObjectId(conversationId),
          message,
          messageType,
          attachments,
        });

        // Broadcast to conversation room (including sender)
        io.to(conversationId).emit("receiveMessage", savedMessage);

        // Broadcast conversationUpdated to all participants of this conversation
        conversation.participants.forEach((pId) => {
          io.to(`user:${pId.toString()}`).emit("conversationUpdated", {
            conversationId,
            lastMessage: savedMessage,
          });
        });
      } catch (error: any) {
        socket.emit("error", { message: error.message || "Failed to send message" });
      }
    }
  );

  // Event: typing
  socket.on("typing", async ({ conversationId }: { conversationId: string }) => {
    try {
      if (!conversationId) return;
      await checkConversationParticipant(conversationId, user._id);
      socket.to(conversationId).emit("typing", { conversationId, userId });
    } catch (error) {
      // Quietly ignore check errors to not spam connection
    }
  });

  // Event: stopTyping
  socket.on("stopTyping", async ({ conversationId }: { conversationId: string }) => {
    try {
      if (!conversationId) return;
      await checkConversationParticipant(conversationId, user._id);
      socket.to(conversationId).emit("stopTyping", { conversationId, userId });
    } catch (error) {
      // Quietly ignore
    }
  });

  // Event: markAsRead
  socket.on("markAsRead", async ({ conversationId }: { conversationId: string }) => {
    try {
      if (!conversationId) return;

      const conversation = await checkConversationParticipant(conversationId, user._id);

      // Perform mark messages read in DB
      await ChatServices.markMessagesAsRead(user._id, conversationId);

      // Broadcast messageRead to room
      io.to(conversationId).emit("messageRead", { conversationId, userId });

      // Notify all participants about conversation changes (unread count decreases)
      conversation.participants.forEach((pId) => {
        io.to(`user:${pId.toString()}`).emit("conversationUpdated", { conversationId });
      });
    } catch (error: any) {
      socket.emit("error", { message: error.message || "Failed to mark conversation as read" });
    }
  });

  // Event: disconnect / userOffline
  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    socket.broadcast.emit("userOffline", { userId });
    console.log(`[Socket Chat] User disconnected: ${userId}`);
  });
};
