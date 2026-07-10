import Redis from "ioredis";
import config from "../config";

export const redisConnectionOptions = {
  host: config.redis_host,
  port: config.redis_port,
  password: config.redis_password || undefined,
  maxRetriesPerRequest: null, // Essential for BullMQ compatibility
};

// Reusable connection instance
export const redisConnection = new Redis(redisConnectionOptions);
