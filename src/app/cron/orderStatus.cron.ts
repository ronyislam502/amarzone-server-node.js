import cron from "node-cron";
import { OrderServices } from "../modules/order/order.service";

export const initializeOrderStatusCron = () => {
  console.log(
    "[Order Status Cron] Initializing automatic order shipping status progression scheduler..."
  );

  // Initial startup sweep (5s delay to ensure DB and socket connections are fully ready)
  setTimeout(async () => {
    try {
      console.log(
        "[Order Status Cron] Executing startup sweep for order status progression..."
      );
      const result = await OrderServices.scheduleOrderStatusUpdates();
      if (result.updatedCount > 0) {
        console.log(
          `[Order Status Cron] Startup sweep progressed ${result.updatedCount} order(s).`
        );
      } else {
        console.log(
          "[Order Status Cron] No orders needed status progression on startup."
        );
      }
    } catch (error) {
      console.error(
        "[Order Status Cron] Error during startup order status sweep:",
        error
      );
    }
  }, 5000);

  // Scheduled recurring job: every 15 minutes
  cron.schedule("*/15 * * * *", async () => {
    try {
      const result = await OrderServices.scheduleOrderStatusUpdates();
      if (result.updatedCount > 0) {
        console.log(
          `[Order Status Cron] Automatically advanced ${result.updatedCount} order(s).`
        );
      }
    } catch (error) {
      console.error(
        "[Order Status Cron] Error during order status sweep:",
        error
      );
    }
  });

  console.log(
    "[Order Status Cron] Scheduled: Every 15 minutes (*/15 * * * *) to automatically advance SHIPPED -> IN_TRANSIT -> OUT_OF_DELIVERY -> DELIVERED."
  );
};
