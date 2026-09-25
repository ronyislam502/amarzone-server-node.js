import cron from "node-cron";
import { AccountHealthServices } from "../modules/health/health.service";

export const initializeVendorHealthCron = () => {
  console.log(
    "[Vendor Health Cron] Initializing automatic vendor health recalculation scheduler..."
  );

  // Initial startup sweep (after 8s delay to ensure DB, models, and socket connections are fully ready)
  setTimeout(async () => {
    try {
      console.log(
        "[Vendor Health Cron] Executing initial vendor health recalculation on startup..."
      );
      const results = await AccountHealthServices.recalculateAllVendorsHealth();
      console.log(
        `[Vendor Health Cron] Startup recalculation complete. Processed ${results.length} vendor(s).`
      );
    } catch (error) {
      console.error(
        "[Vendor Health Cron] Error during startup vendor health recalculation:",
        error
      );
    }
  }, 8000);

  // Scheduled recurring job: Every hour on the hour ("0 * * * *")
  cron.schedule("0 * * * *", async () => {
    const runTime = new Date().toISOString();
    console.log(
      `[Vendor Health Cron] Automatic hourly vendor health recalculation triggered at ${runTime}...`
    );

    try {
      const results = await AccountHealthServices.recalculateAllVendorsHealth();
      console.log(
        `[Vendor Health Cron] Hourly recalculation completed successfully for ${results.length} vendor(s).`
      );
    } catch (error) {
      console.error(
        "[Vendor Health Cron] Error during hourly vendor health recalculation:",
        error
      );
    }
  });

  console.log(
    "[Vendor Health Cron] Scheduled: Hourly (0 * * * *) to automatically recalculate all vendor health metrics."
  );
};
