import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { userSocket } from "./user.socket";


export const initializeSocket = (server: HttpServer) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);

        // Initialize user-related socket events
        userSocket(io, socket);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });
};
