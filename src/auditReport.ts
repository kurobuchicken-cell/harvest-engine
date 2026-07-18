import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { readAllEntries } from "./lib/ledger";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LEDGER_FAIL_MARKER = "ledger記帳に失敗しました";
const COUNCIL_STARTED_MARKER = "[councilScheduler] started";
const RECENT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000; // 週次実行の間隔(7日)に1日の余裕を足した監視窓

async function scanLogsForFailures(): Promise<{ file: string; lines: string[] }[]> {
  const results: { file: string; lines: string[] }[] = [];
  let files: string[];
  try {
    files = await readdir(LOG_DIR);
  } catch {
    return results;
  }
  for (const file of files) {
    if (!file.endsWith(".log")) continue;
    try {
      const text = await readFile(path.join(LOG_DIR, file), "utf-8");
      const lines = text.split("\n").filter((l) => l.includes(LEDGER_FAIL_MARKER));
      if (lines.length > 0) results.push({ file, lines });
    } catch {
      // ログファイルが読めない場合はスキップ(権限等)
    }
  }
  return results;
}

async function checkUnresolvedFxRate() {
  const entries = await readAllEntries();
  return entries.filter((e) => e.fxRateStatus === "unresolved");
}

// council-schedulerの実行ログ(started行)とledgerのcouncil-opusエントリを突合する。
// 実行された形跡があるのに記帳が一件も無ければ、記帳失敗ログにも捕捉されなかった
// 未知の記帳漏れの可能性があるため異常フラグを立てる
async function checkCouncilScheduleVsLedger(): Promise<{
  startedRecently: boolean;
  recentCouncilEntryCount: number;
}> {
  const entries = await readAllEntries();
  const now = Date.now();
  const recentCouncilEntryCount = entries.filter((e) => {
    if (e.service !== "council-opus") return false;
    const occurred = new Date(e.occurredAt).getTime();
    return !Number.isNaN(occurred) && now - occurred < RECENT_WINDOW_MS;
  }).length;

  let startedRecently = false;
  try {
    const text = await readFile(path.join(LOG_DIR, "council-scheduler-out.log"), "utf-8");
    startedRecently = text
      .split("\n")
      .filter((l) => l.includes(COUNCIL_STARTED_MARKER))
      .some((l) => {
        const match = l.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
        if (!match) return false;
        const t = new Date(match[1]).getTime();
        return now - t < RECENT_WINDOW_MS;
      });
  } catch {
    // ログ自体が無い環境(ローカル等、council-schedulerを稼働させていない場合)はスキップ
  }

  return { startedRecently, recentCouncilEntryCount };
}

async function main() {
  console.log("=== 監査役 週次バッチ ===");
  console.log(`実行時刻: ${new Date().toISOString()}\n`);

  const failures = await scanLogsForFailures();
  if (failures.length === 0) {
    console.log("[1] 記帳失敗ログ(ledger記帳に失敗しました): 検出なし");
  } else {
    console.log(`[1] 記帳失敗ログ(ledger記帳に失敗しました): ${failures.length}ファイルで検出`);
    for (const f of failures) {
      console.log(`  - ${f.file}: ${f.lines.length}件`);
      for (const line of f.lines.slice(-5)) {
        console.log(`      ${line}`);
      }
    }
  }

  const unresolved = await checkUnresolvedFxRate();
  if (unresolved.length === 0) {
    console.log("\n[2] 為替レート未解決エントリ(fxRateStatus=unresolved): なし");
  } else {
    console.log(`\n[2] 為替レート未解決エントリ(fxRateStatus=unresolved): ${unresolved.length}件`);
    for (const e of unresolved) {
      console.log(`  - ${e.id} service=${e.service} desc="${e.description}" occurredAt=${e.occurredAt}`);
    }
  }

  const council = await checkCouncilScheduleVsLedger();
  console.log("\n[3] 評議会週次実行とledgerの突合:");
  if (council.startedRecently && council.recentCouncilEntryCount === 0) {
    console.log(
      "  ⚠ 直近8日以内にcouncil-schedulerの実行ログはあるが、対応するcouncil-opusのledgerエントリが" +
        "見つかりません(記帳失敗ログにも出ていない未知の記帳漏れの可能性、要手動確認)",
    );
  } else if (!council.startedRecently) {
    console.log("  (直近8日以内のcouncil-scheduler実行ログなし、またはこの環境にログファイル自体が無い)");
  } else {
    console.log(`  OK: 直近8日でcouncil-opusエントリ${council.recentCouncilEntryCount}件を確認`);
  }

  console.log("\n=== 監査終了 ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
