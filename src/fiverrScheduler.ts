import "dotenv/config";
import cron from "node-cron";
import { runOnce } from "./fiverr/watch";

// 30分ごとに Fiverr のメールを読む。朝9時の件数も同じ回の中で送る(9時台の最初の回。止まっていた後も、動き出した最初の回で送る)
let running = false;
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runOnce();
  } catch (err) {
    console.error("[fiverrScheduler]", err);
  } finally {
    running = false;
  }
}

cron.schedule("*/30 * * * *", tick, { timezone: "Asia/Tokyo" });
console.log("[fiverrScheduler] started (every 30 min, daily count at 09:00 JST)");
void tick();
