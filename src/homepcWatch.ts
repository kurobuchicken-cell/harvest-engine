import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { jstDate, slackSend } from "./fiverr/watch";

// 家PCは毎朝9時の停止(sugoi-shorts src/autorun-stop.ps1)で data/homepc-morning.txt に時刻を書きに来る。
// スリープから戻れず止まった朝はこれが来ないので、VM から知らせる(家PCが止まっていると家PCからは知らせられないため)
const DATA = path.resolve(__dirname, "..", "data");
export const PING_PATH = path.join(DATA, "homepc-morning.txt");
const STATE_PATH = path.join(DATA, "homepc-watch.json");
const CHECK_AFTER_MIN = 9 * 60 + 40;

export async function checkHomePc(send: (t: string) => Promise<void> = slackSend, now = Date.now()): Promise<void> {
  const jst = new Date(now + 9 * 3600_000);
  if (jst.getUTCHours() * 60 + jst.getUTCMinutes() < CHECK_AFTER_MIN) return;
  const today = jstDate(now);
  const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : {};
  if (state.checkedFor === today) return;

  const ping = existsSync(PING_PATH) ? readFileSync(PING_PATH, "utf8").trim() : "";
  const pingDay = ping ? jstDate(Date.parse(ping)) : null;
  if (pingDay !== today) {
    await send(`⚠️ 家PCが今朝9時に起きていなかった(最後に起きていた印: ${ping || "なし"})。スリープから戻れず止まっている可能性がある。PC の電源を確かめ、止まっていたら入れる。昨夜の夜間作業は抜けている`);
  }
  writeFileSync(STATE_PATH, JSON.stringify({ checkedFor: today, ping, alerted: pingDay !== today }));
}
