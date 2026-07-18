import cron from "node-cron";
import { runCouncilPipeline } from "./council/run";

// 毎週月曜 00:00 UTC(= 09:00 JST)に評議会パイプラインを実行する。
// src/scheduler.ts(毎分tickの巡回スケジューラ)とは独立したプロセスとして動かす
export function startCouncilScheduler(): void {
  cron.schedule("0 0 * * 1", () => {
    runCouncilPipeline().catch((err) => {
      console.error("[councilScheduler] runCouncilPipeline failed:", err);
    });
  });
  console.log("[councilScheduler] started (weekly: Mon 00:00 UTC = 09:00 JST)");
}

if (require.main === module) {
  startCouncilScheduler();
}
