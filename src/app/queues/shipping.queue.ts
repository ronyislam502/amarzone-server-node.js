import { Queue } from "bullmq";
import { redisConnectionOptions } from "../redis/redis";

export const shippingQueue = new Queue("shipping", {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
