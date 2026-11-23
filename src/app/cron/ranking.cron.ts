import cron from "node-cron";
import { RankingServices } from "../modules/ranking/ranking.service";

export const initializeRankingCron = () => {
    console.log(
        "[Ranking Cron] Initializing automatic BSR (Best Sellers Rank) recalculation scheduler..."
    );

    // Initial startup sweep (after 10s delay to ensure DB, models, and socket connections are ready)
    setTimeout(async () => {
        try {
            console.log(
                "[Ranking Cron] Executing initial BSR calculation on startup..."
            );
            const result = await RankingServices.recalculateAllBSR();
            console.log(
                `[Ranking Cron] Startup BSR calculation complete. Processed ${result?.totalVariantsRanked || 0} variant(s).`
            );
        } catch (error) {
            console.error(
                "[Ranking Cron] Error during startup BSR calculation:",
                error
            );
        }
    }, 10000);

    // Scheduled recurring job: Every hour on the hour ("0 * * * *")
    cron.schedule("0 * * * *", async () => {
        const runTime = new Date().toISOString();
        console.log(
            `[Ranking Cron] Automatic hourly BSR recalculation triggered at ${runTime}...`
        );

        try {
            const result = await RankingServices.recalculateAllBSR();
            console.log(
                `[Ranking Cron] Hourly BSR recalculation completed successfully for ${result?.totalVariantsRanked || 0} variant(s).`
            );
        } catch (error) {
            console.error(
                "[Ranking Cron] Error during hourly BSR recalculation:",
                error
            );
        }
    });

    console.log(
        "[Ranking Cron] Scheduled: Hourly (0 * * * *) to automatically recalculate all product BSR rankings."
    );
};
