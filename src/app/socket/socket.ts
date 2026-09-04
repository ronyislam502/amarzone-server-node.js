import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { chatSocket } from "./chat.socket";
import { registerFraudHandlers } from "./socketFraud";

let io: Server | null = null;

export const initializeSocket = (server: HttpServer): Server => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        // Initialize chat-related socket events
        chatSocket(io as Server, socket);

        // Initialize fraud-related socket events
        registerFraudHandlers(io as Server, socket);

        // General room join/leave events
        socket.on("join_room", (room: string) => {
            if (room) {
                socket.join(room);
                console.log(`Socket ${socket.id} joined room: ${room}`);
            }
        });

        socket.on("leave_room", (room: string) => {
            if (room) {
                socket.leave(room);
                console.log(`Socket ${socket.id} left room: ${room}`);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });

    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error("Socket.io is not initialized! Call initializeSocket(server) first.");
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

