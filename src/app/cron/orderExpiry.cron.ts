import cron from "node-cron";
import { OrderServices } from "../modules/order/order.service";

export const initializeOrderExpiryCron = () => {
  console.log(
    "[Order Expiry Cron] Initializing 7-day unpaid order cancellation scheduler..."
  );

  // Initial startup sweep (5s delay to ensure DB and socket connections are fully ready)
  setTimeout(async () => {
    try {
      console.log(
        "[Order Expiry Cron] Executing startup sweep for unpaid orders past 7 days..."
      );
      const result = await OrderServices.cancelExpiredUnpaidOrders(7);
      if (result.cancelledCount > 0) {
        console.log(
          `[Order Expiry Cron] Startup sweep cancelled ${result.cancelledCount} expired order(s):`,
          result.orderIds
        );
      } else {
        console.log("[Order Expiry Cron] No expired unpaid orders found on startup.");
      }
    } catch (error) {
      console.error(
        "[Order Expiry Cron] Error during startup order expiry sweep:",
        error
      );
    }
  }, 5000);

  // Scheduled recurring job: every hour on the hour
  cron.schedule("0 * * * *", async () => {
    const runTime = new Date().toISOString();
    console.log(
      `[Order Expiry Cron] Hourly sweep triggered at ${runTime}...`
    );

    try {
      const result = await OrderServices.cancelExpiredUnpaidOrders(7);
      if (result.cancelledCount > 0) {
        console.log(
          `[Order Expiry Cron] Automatically cancelled ${result.cancelledCount} expired order(s):`,
          result.orderIds
        );
      }
    } catch (error) {
      console.error(
        "[Order Expiry Cron] Error during hourly order expiry sweep:",
        error
      );
    }
  });

  console.log(
    "[Order Expiry Cron] Scheduled: Hourly (0 * * * *) to auto-cancel orders older than 7 days."
  );
};
