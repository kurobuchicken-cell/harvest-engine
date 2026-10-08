import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import cron from "node-cron";
import { notifyAnomalies } from "./factory/notify";
import { GENRES } from "./factory/registry";

// 1ジャンルの実行がこれを超えたら打ち切る(補助金の初回がVMで10分超。通常は差分のみでずっと短い)
const GENRE_TIMEOUT_MS = 60 * 60 * 1000;
const TSX_CLI = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

let running = false;

// VMの空きメモリが約380MBしかないため、ジャンルごとに別プロセスで順番に動かし、終わるたびにメモリを返す
function runChild(genreId: string): Promise<{ code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TSX_CLI, "src/factory/run.ts", genreId, "--notify"], { cwd: process.cwd(), stdio: "inherit" });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, GENRE_TIMEOUT_MS);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut });
    });
  });
}

export async function runAllGenres(): Promise<void> {
  if (running) {
    console.warn("[factoryScheduler] 前回の実行が終わっていないため今回はスキップします");
    return;
  }
  running = true;
  try {
    for (const genre of GENRES) {
      console.log(`[factoryScheduler] ${genre.id} start`);
      const { code, timedOut } = await runChild(genre.id);
      console.log(`[factoryScheduler] ${genre.id} exit code=${code} timedOut=${timedOut}`);
      if (code !== 0 || timedOut) {
        const reason = timedOut ? `${GENRE_TIMEOUT_MS / 60000}分を超えたため打ち切りました` : `異常終了しました(exit code=${code})`;
        await notifyAnomalies(`出口工場 定期実行: ${genre.id}`, [`実行が${reason}。pm2ログ(factory-scheduler)を確認してください`], new Date().toISOString()).catch(
          (err) => console.error("[factoryScheduler] notify failed:", err),
        );
      }
    }
  } finally {
    running = false;
  }
}

// 峠の開通・閉鎖の発表が動く季節(春3/1〜6/30・秋10/15〜12/15、JST)は、当日朝に知らせるため日中3時間ごとにも見張る(仕様書_toge-log 2-2)
export function inTogeSeason(now: Date): boolean {
  const md = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(5);
  return (md >= "03-01" && md <= "06-30") || (md >= "10-15" && md <= "12-15");
}

export async function runTogeInSeason(now = new Date()): Promise<void> {
  if (!inTogeSeason(now)) return;
  if (running) {
    console.warn("[factoryScheduler] 実行中のためtogeの季節実行をスキップします");
    return;
  }
  running = true;
  try {
    const { code, timedOut } = await runChild("toge");
    console.log(`[factoryScheduler] toge(season) exit code=${code} timedOut=${timedOut}`);
    if (code !== 0 || timedOut) {
      await notifyAnomalies("出口工場 季節実行: toge", [`実行が異常終了しました(exit code=${code} timedOut=${timedOut})。pm2ログ(factory-scheduler)を確認してください`], now.toISOString()).catch(
        (err) => console.error("[factoryScheduler] notify failed:", err),
      );
    }
  } finally {
    running = false;
  }
}

// 毎日19:00 UTC(= 04:00 JST)。評議会(月曜09:00 JST)・監査(月曜10:00 JST)とは重ならない
// 峠の季節実行は06・09・12・15・18・21時JST(= 21・0・3・6・9・12時UTC)
export function startFactoryScheduler(): void {
  cron.schedule("0 19 * * *", () => {
    runAllGenres().catch((err) => console.error("[factoryScheduler] failed:", err));
  });
  cron.schedule("0 21,0,3,6,9,12 * * *", () => {
    runTogeInSeason().catch((err) => console.error("[factoryScheduler] toge season failed:", err));
  });
  console.log("[factoryScheduler] started (daily: 19:00 UTC = 04:00 JST, toge season: every 3h 06-21 JST)");
}

if (require.main === module) {
  startFactoryScheduler();
}
