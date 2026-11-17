import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { jstDate, slackSend } from "./fiverr/watch";

// 家PCは毎朝9時の停止(sugoi-shorts src/autorun-stop.ps1)で data/homepc-morning.txt に時刻を書きに来る。
// スリープから戻れず止まった朝はこれが来ないので、VM から知らせる(家PCが止まっていると家PCからは知らせられないため)
const DATA = path.resolve(__dirname, "..", "data");
export const PING_PATH = path.join(DATA, "homepc-morning.txt");
const STATE_PATH = path.join(DATA, "homepc-watch.json");
// 9時の停止と、失敗した朝の拾い直し(9時20分・9時40分)が済んだあとに見る
const CHECK_AFTER_MIN = 10 * 60;

export async function checkHomePc(send: (t: string) => Promise<void> = slackSend, now = Date.now()): Promise<void> {
  const jst = new Date(now + 9 * 3600_000);
  if (jst.getUTCHours() * 60 + jst.getUTCMinutes() < CHECK_AFTER_MIN) return;
  const today = jstDate(now);
  const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, "utf8")) : {};
  if (state.checkedFor === today) return;

  const ping = existsSync(PING_PATH) ? readFileSync(PING_PATH, "utf8").trim() : "";
  const pingDay = ping ? jstDate(Date.parse(ping)) : null;
  if (pingDay !== today) {
    await send(`⚠️ 家PCの朝の処理(9時・拾い直しの9時20分・9時40分)が今朝は動かなかった(最後に動いた印: ${ping || "なし"})。PC が止まっている(スリープから戻れない等)か、朝の処理が失敗している。朝の報告も届いていない。PC の電源と、GM に昼のセッションで確かめさせる`);
  }
  writeFileSync(STATE_PATH, JSON.stringify({ checkedFor: today, ping, alerted: pingDay !== today }));
}
