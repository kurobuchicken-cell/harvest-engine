import "dotenv/config";
import cron from "node-cron";
import { runAudit } from "./auditReport";
import { notifyAuditResult } from "./auditNotify";

// 毎週月曜 01:00 UTC(= 10:00 JST)に監査バッチを実行する。
// council-scheduler(月曜00:00 UTC)の1時間後に設定し、その週の評議会実行・記帳が
// 完了しているタイミングで突合できるようにしている。src/scheduler.ts・
// src/councilScheduler.ts(いずれも独立プロセス)とは別のPM2プロセスとして動かす
export function startAuditScheduler(): void {
  cron.schedule("0 1 * * 1", () => {
    runAudit()
      .then((result) => notifyAuditResult(result))
      .catch((err) => {
        console.error("[auditScheduler] runAudit failed:", err);
      });
  });
  console.log("[auditScheduler] started (weekly: Mon 01:00 UTC = 10:00 JST)");
}

if (require.main === module) {
  startAuditScheduler();
}
