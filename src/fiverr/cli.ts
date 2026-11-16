import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { listMessageIds, getHeader, profileEmail } from "./gmail";
import { classify, countDay, jstDate, runOnce, State, STATE_PATH } from "./watch";

const VM_HOST = "ubuntu@161.33.148.155";
const VM_KEY = path.resolve(__dirname, "..", "..", "tokens", "harvest_engine_vm_key");
const VM_STATE = "/home/ubuntu/apps/harvest-engine/data/fiverr-watch.json";

function summarize(state: State, now = Date.now()): string {
  const y = jstDate(now - 24 * 3600_000);
  const c = countDay(state, y);
  const ageMin = state.lastOkAt ? Math.round((now - state.lastOkAt) / 60_000) : null;
  const alive =
    !state.lastError && ageMin !== null && ageMin <= 70
      ? `動いている(${ageMin}分前に読めた)`
      : `止まっている(${ageMin === null ? "一度も読めていない" : `${ageMin}分前が最後`}${state.lastError ? `: ${state.lastError.slice(0, 80)}` : ""})`;
  return `Fiverr(${y}): 注文${c.order}・連絡${c.message}・VM の知らせ ${alive}`;
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "list") {
    // 見分けを本物の件名に合わせるため。Slack には送らない
    console.log(`account: ${await profileEmail()}`);
    for (const id of await listMessageIds("from:fiverr.com newer_than:7d")) {
      const h = await getHeader(id);
      console.log(`${new Date(h.receivedAt).toISOString()}\t${classify(h.subject)}\t${h.from}\t${h.subject}`);
    }
  } else if (cmd === "once") {
    const dry = process.argv.includes("--dry");
    await runOnce(dry ? async (t) => console.log(`[dry] ${t}`) : undefined);
    console.log(summarize(JSON.parse(readFileSync(STATE_PATH, "utf8"))));
  } else if (cmd === "status") {
    // 夜間作業のレポートの1行。VM の記録を ssh で読む
    const r = spawnSync("ssh", ["-i", VM_KEY, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", VM_HOST, "cat", VM_STATE], { encoding: "utf-8" });
    if (r.status !== 0) {
      console.log(`Fiverr: VM の記録を読めない(${(r.stderr || r.error?.message || "").trim().slice(0, 100)})`);
      process.exitCode = 1;
      return;
    }
    console.log(summarize(JSON.parse(r.stdout)));
  } else {
    console.log("使い方: npm run fiverr:watch -- list | once [--dry] | status");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
