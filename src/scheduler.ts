import cron from "node-cron";
import { crawlAllDue } from "./crawler";

// 毎分tickし、fetch_interval_minに従って巡回が必要なsourceだけを実際に処理する
export function startScheduler(): void {
  cron.schedule("* * * * *", () => {
    crawlAllDue().catch((err) => {
      console.error("[scheduler] crawlAllDue failed:", err);
    });
  });
  console.log("[scheduler] started (tick: every 1 minute)");
}

if (require.main === module) {
  startScheduler();
}
