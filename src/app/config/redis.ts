import Redis from "ioredis";
import config from "../config";

export const redisConnectionOptions = {
    host: config.redis_host || "127.0.0.1",
    port: Number(config.redis_port) || 6379,
    password: config.redis_password || undefined,
    maxRetriesPerRequest: null, // Essential for BullMQ compatibility
};

// Reusable connection instance
export const redisConnection = new Redis(redisConnectionOptions);

redisConnection.on("connect", () => {
    console.log("Redis Connected");
});