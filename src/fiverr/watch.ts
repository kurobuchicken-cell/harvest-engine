import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { postSlackJson } from "../lib/slackWebhook";
import { listMessageIds, getHeader, GmailAuthError, MailHeader } from "./gmail";

export const STATE_PATH = path.resolve(__dirname, "..", "..", "data", "fiverr-watch.json");
const QUERY = "from:fiverr.com newer_than:3d";
const ORDERS_URL = "https://www.fiverr.com/users/pj_harvest/manage_orders";
const KEEP_DAYS = 30;
const DAILY_HOUR_JST = 9;
// 30分ごとなので、2回続けて読めなければ1時間止まっている
const FAIL_ALERT_AFTER = 2;

export type Kind = "order" | "message" | "other";

interface Seen {
  receivedAt: number;
  kind: Kind;
  subject: string;
}

export interface State {
  seen: Record<string, Seen>;
  lastOkAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  failureAlertedAt: number | null;
  dailySentFor: string | null;
  baselineDone: boolean;
}

// 件名だけで分ける。Fiverr の実際の件名で合わせる(2026-11-16 時点の件名は仕様書)
export function classify(subject: string): Kind {
  const s = subject.toLowerCase();
  if (/review|rate your|\btip\b/.test(s)) return "other";
  if (/\border\b|placed an order|new order|注文/.test(s)) return "order";
  if (/message|inquiry|sent you|メッセージ/.test(s)) return "message";
  return "other";
}

export function loadState(): State {
  if (!existsSync(STATE_PATH)) {
    return { seen: {}, lastOkAt: null, lastError: null, consecutiveFailures: 0, failureAlertedAt: null, dailySentFor: null, baselineDone: false };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

function saveState(state: State): void {
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function jstDate(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
}

function jstHour(ms: number): number {
  return new Date(ms + 9 * 3600_000).getUTCHours();
}

function jstTime(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(5, 16).replace("T", " ");
}

function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Send = (text: string) => Promise<void>;

export const slackSend: Send = async (text) => {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error("SLACK_WEBHOOK_URL が .env に無い");
  const mention = process.env.SLACK_MENTION_USER_ID ? `<@${process.env.SLACK_MENTION_USER_ID}> ` : "";
  await postSlackJson(url, { text: `${mention}${text}` });
};

export function countDay(state: State, day: string): Record<Kind, number> {
  const c: Record<Kind, number> = { order: 0, message: 0, other: 0 };
  for (const s of Object.values(state.seen)) if (jstDate(s.receivedAt) === day) c[s.kind]++;
  return c;
}

export async function runOnce(send: Send = slackSend, now = Date.now()): Promise<void> {
  const state = loadState();

  try {
    const ids = await listMessageIds(QUERY);
    const fresh: MailHeader[] = [];
    for (const id of ids) {
      if (state.seen[id]) continue;
      const h = await getHeader(id);
      state.seen[id] = { receivedAt: h.receivedAt, kind: classify(h.subject), subject: h.subject.slice(0, 200) };
      fresh.push(h);
    }

    // 最初の1回は今あるメールを覚えるだけにする(公開直後の詐欺の連絡で知らせが溢れないように)
    if (state.baselineDone) {
      for (const h of fresh) {
        if (state.seen[h.id].kind !== "order") continue;
        await send(`🛒 Fiverr に注文らしいメール: 「${escapeSlack(h.subject)}」(${jstTime(h.receivedAt)})\n本物かは注文の画面の数で確かめる: ${ORDERS_URL}\nメールのリンクは開かない`);
      }
    }
    state.baselineDone = true;

    if (state.failureAlertedAt) {
      await send("✅ Fiverr の知らせ: Gmail をまた読めるようになった");
    }
    state.lastOkAt = now;
    state.lastError = null;
    state.consecutiveFailures = 0;
    state.failureAlertedAt = null;
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
    state.consecutiveFailures++;
    const authBroken = err instanceof GmailAuthError;
    console.error(`[fiverr-watch] ${state.lastError}`);
    if (!state.failureAlertedAt && (authBroken || state.consecutiveFailures >= FAIL_ALERT_AFTER)) {
      const fix = authBroken ? "家PCで npm run fiverr:login を流し、tokens/fiverr_gmail_token.json を VM に写し直す(仕様書)" : "VM の logs/fiverr-watch-error.log を見る";
      await send(`⚠️ Fiverr の知らせが Gmail を読めない(${state.consecutiveFailures}回続けて): ${escapeSlack(state.lastError.slice(0, 200))}\n直し方: ${fix}`).then(
        () => (state.failureAlertedAt = now),
        (e) => console.error("[fiverr-watch] 止まった知らせを送れなかった", e),
      );
    }
  }

  // 朝の件数は0件の日も送る(送られてくること自体が、見張りが生きている印)
  const today = jstDate(now);
  if (jstHour(now) >= DAILY_HOUR_JST && state.dailySentFor !== today) {
    const yesterday = jstDate(now - 24 * 3600_000);
    const c = countDay(state, yesterday);
    const health = state.lastOkAt ? `最後に読めた ${jstTime(state.lastOkAt)}` : "まだ1回も読めていない";
    const err = state.lastError ? ` / 止まっている: ${escapeSlack(state.lastError.slice(0, 120))}` : "";
    try {
      await send(`📮 Fiverr ${yesterday}: 注文${c.order}・連絡${c.message}・ほか${c.other}(${health}${err})`);
      state.dailySentFor = today;
    } catch (e) {
      console.error("[fiverr-watch] 朝の件数を送れなかった", e);
    }
  }

  const cutoff = now - KEEP_DAYS * 24 * 3600_000;
  for (const [id, s] of Object.entries(state.seen)) if (s.receivedAt < cutoff) delete state.seen[id];
  saveState(state);
}
