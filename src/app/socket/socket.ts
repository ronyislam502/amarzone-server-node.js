import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server | null = null;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    socket.on("join", (roomName: string) => {
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room: ${roomName}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.IO is not initialized! Make sure to call initSocket(server) first.");
  }
  return io;
};

export const emitNotification = (room: string, event: string, data: any) => {
  if (io) {
    io.to(room).emit(event, data);
  } else {
    console.warn("Socket.IO not initialized. Skipping real-time notification.");
  }
};
