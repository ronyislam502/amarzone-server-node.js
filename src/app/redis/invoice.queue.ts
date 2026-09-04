import { Queue } from "bullmq";
import { redisConnectionOptions } from "../redis/redis";

export const invoiceQueue = new Queue("invoice", {
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
