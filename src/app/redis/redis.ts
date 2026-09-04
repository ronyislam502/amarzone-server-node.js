import Redis from "ioredis";
import config from "../config";

export const redisConnectionOptions = {
  host: config.redis_host,
  port: Number(config.redis_port),
  password: config.redis_password,
  maxRetriesPerRequest: null
};

// Reusable connection instance
export const redisConnection = new Redis(redisConnectionOptions);

redisConnection.on("connect", () => {
  console.log("Redis Connected");
});

redisConnection.on("error", (err) => {
  console.error("Redis Error:", err);
});
