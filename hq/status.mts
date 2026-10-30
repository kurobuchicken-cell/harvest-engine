// セッションの始めと報告で見る「今の状態」を記録から出す。HANDOFF に状態を手で書き写すと古くなるため(くわしくは HISTORY.md の 2026-10-30)
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { openTasks, taskLine, todayJst } from "./tasks.mts";

const DEV = path.resolve(import.meta.dirname, "..", "..");
const SUGOI = path.join(DEV, "sugoi-shorts");
const REPOS = ["harvest-engine", "sugoi-shorts", "dev-config"];

const run = (cmd: string, args: string[], cwd = DEV) => {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 }).trim();
  } catch (e) {
    return `(失敗: ${(e as Error).message.split("\n")[0]})`;
  }
};
const jst = (sec: number) => new Date(sec * 1000 + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ");

console.log(`# 状態(${todayJst()})`);

console.log("\n■ git(fetch 済みの差分)");
for (const r of REPOS) {
  const dir = path.join(DEV, r);
  run("git", ["fetch", "-q"], dir);
  const st = run("git", ["status", "-sb", "--porcelain"], dir).split("\n");
  console.log(`・${r}: ${st[0].replace(/^## /, "")}${st.length > 1 ? ` / 未コミット ${st.length - 1}件` : ""}`);
}

console.log("\n■ 夜間作業(テーマU)");
if (process.platform === "win32") {
  const ps = `Get-ScheduledTask -TaskName 'sugoi-shorts autorun *' | ForEach-Object { $i = $_ | Get-ScheduledTaskInfo; '{0}|{1}|{2:MM-dd HH:mm}|{3}|{4:MM-dd HH:mm}' -f $_.TaskName,$_.State,$i.LastRunTime,$i.LastTaskResult,$i.NextRunTime }`;
  for (const l of run("powershell.exe", ["-NoProfile", "-Command", ps]).split("\n").filter(Boolean)) {
    const [name, state, last, result, next] = l.trim().split("|");
    console.log(`・${name?.replace("sugoi-shorts autorun ", "")}: ${state} / 前回 ${last}(結果 ${result}) / 次 ${next}`);
  }
}
const reports = (await readdir(path.join(SUGOI, "work"))).filter((f) => /^autorun-report-\d{4}-\d\d-\d\d\.md$/.test(f)).sort();
console.log(`・最後のレポート: ${reports.at(-1) ?? "なし"}`);
const usage = JSON.parse(await readFile(path.join(SUGOI, "work", "usage.json"), "utf-8").catch(() => "{}"));
if (usage.updatedAt) {
  const reset = usage.sevenDayResetsAt * 1000 < Date.now() ? "(リセット済み。今の値は次に動いた時に分かる)" : "";
  console.log(`・使用率(${jst(usage.updatedAt)} 時点): 5時間枠 ${usage.fiveHourPct}% / 7日枠 ${usage.sevenDayPct}%、7日枠のリセット ${jst(usage.sevenDayResetsAt)}${reset}`);
}

const { pendingLines } = await import("../../sugoi-shorts/src/reminders.ts");
const { accountMessage } = await import("../../sugoi-shorts/src/accounts.ts");
console.log("\n■ 投稿(テーマU、記録から)");
for (const l of await pendingLines()) console.log(l);
const acc = await accountMessage();
if (acc) console.log(acc.split("\n")[0]);

const { due, later } = await openTasks();
for (const [who, label] of [["owner", "オーナーのやること・判断"], ["gm", "GMのやること"]] as const) {
  const xs = due.filter((x) => x.who === who);
  console.log(`\n■ ${label}(${xs.length}件、hq/tasks.json)`);
  for (const x of xs) console.log(taskLine(x));
}
const soon = later.filter((x) => x.from <= todayJst(new Date(Date.now() + 14 * 864e5)));
if (soon.length) {
  console.log(`\n■ 2週間以内に始まるもの(${soon.length}件)`);
  for (const x of soon) console.log(`・${x.from}〜 ${x.who === "owner" ? "オーナー" : "GM"} ${x.text.slice(0, 70)} {${x.id}}`);
}
