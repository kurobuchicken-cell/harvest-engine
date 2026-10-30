// 売上に直結する数字と、夜間作業の質・効率の数字を記録から出し、前回と比べる(GMの記憶や夜のレポートの主張に頼らないため)。
// 案は hq/tasks.json に kind=kaizen(動かす数字 measure・今の値 baseline)で登録し、ここで前後を並べる
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { openTasks, todayJst } from "./tasks.mts";

const SUGOI = path.resolve(import.meta.dirname, "..", "..", "sugoi-shorts");
const readJson = async (f: string) => JSON.parse(await readFile(f, "utf-8"));
const fmt = (n: number) => n.toLocaleString("ja-JP");
const diff = (a: number | null, b: number | null) => (a === null || b === null ? "" : ` (${b - a >= 0 ? "+" : ""}${fmt(b - a)})`);

// --- 夜間作業(metrics/laps-<night>.jsonl) ---
interface Lap { night: string; episode: string; step: string; tokens?: number; role?: string; model?: string; sevenDayPct?: number }
async function nights(): Promise<Map<string, Lap[]>> {
  const dir = path.join(SUGOI, "metrics");
  const out = new Map<string, Lap[]>();
  for (const f of (await readdir(dir)).filter((f) => /^laps-\d{4}-\d\d-\d\d\.jsonl$/.test(f)).sort()) {
    const rows = (await readFile(path.join(dir, f), "utf-8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Lap);
    out.set(f.slice(5, 15), rows);
  }
  return out;
}
function nightSummary(rows: Lap[]) {
  const tokens = rows.reduce((a, r) => a + (r.tokens ?? 0), 0);
  const eps = new Set(rows.filter((r) => r.episode && !/^(session|start|end)/.test(r.episode)).map((r) => r.episode));
  const rounds = new Map<string, number>();
  for (const r of rows) {
    const m = /^check-(\d+)$/.exec(r.step);
    if (m) rounds.set(r.episode, Math.max(rounds.get(r.episode) ?? 0, Number(m[1])));
  }
  const pct = rows.map((r) => r.sevenDayPct).filter((x): x is number => typeof x === "number");
  const byRole = new Map<string, number>();
  for (const r of rows) if (r.role) byRole.set(r.role, (byRole.get(r.role) ?? 0) + (r.tokens ?? 0));
  const heaviest = [...byRole].sort((a, b) => b[1] - a[1])[0];
  const avgRounds = rounds.size ? [...rounds.values()].reduce((a, b) => a + b, 0) / rounds.size : null;
  return { tokens, episodes: eps.size, avgRounds, sevenDayDelta: pct.length ? Math.max(...pct) - Math.min(...pct) : null, heaviest };
}

// --- 売上側(metrics/reach-<date>.json。手で記録した JSON で形がゆれるので、取れる所だけ取る) ---
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const sumBy = (arr: unknown, key: string) => (Array.isArray(arr) ? arr.reduce((a: number, x: any) => a + (num(x?.[key]) ?? 0), 0) : null);
function reachSummary(j: any) {
  const langs = (o: any) => Object.entries(o ?? {}).filter(([k, v]) => typeof v === "object" && v && !Array.isArray(v) && k !== "publications");
  const ig = langs(j.instagram);
  const tt = langs(j.tiktok);
  const subs = Object.values(j.substack?.publications ?? {}) as any[];
  return {
    igFollowers: ig.length ? ig.reduce((a, [, v]: any) => a + (num(v.followers) ?? 0), 0) : null,
    igPlays: ig.length ? ig.reduce((a, [, v]: any) => a + (sumBy(v.reels, "plays") ?? 0), 0) : null,
    ttViews: tt.length ? tt.reduce((a, [, v]: any) => a + (sumBy(v.videos, "views") ?? 0), 0) : null,
    notePV: num(j.note?.ja?.totalPV) ?? sumBy(j.note?.ja?.articles, "pv") ?? sumBy(j.note?.ja?.articles, "pageViews"),
    noteSales: num(j.note?.ja?.sales) ?? num(j.note?.ja?.last28days?.sales) ?? sumBy(j.note?.ja?.articles, "sales"),
    substackSubs: subs.length ? subs.reduce((a, p) => a + (num(p.subscribers) ?? 0), 0) : null,
  };
}
async function reaches() {
  const dir = path.join(SUGOI, "metrics");
  const files = (await readdir(dir)).filter((f) => /^reach-\d{4}-\d\d-\d\d(-\w+)?\.json$/.test(f)).sort();
  return Promise.all(files.map(async (f) => ({ date: f.slice(6, 16), ...reachSummary(await readJson(path.join(dir, f))) })));
}

// --- 出した本数(episodes/*/episode.json の outlets の日時) ---
async function published(since: string, until: string) {
  const dir = path.join(SUGOI, "episodes");
  const count: Record<string, number> = {};
  for (const d of await readdir(dir)) {
    const ep = await readJson(path.join(dir, d, "episode.json")).catch(() => null);
    for (const [outlet, rec] of Object.entries(ep?.outlets ?? {}) as [string, any][]) {
      const at = String(rec?.at ?? "").slice(0, 10);
      if (at >= since && at < until) count[outlet] = (count[outlet] ?? 0) + 1;
    }
  }
  return count;
}

export async function pdcaLines(brief = false): Promise<string[]> {
  const out: string[] = [];
  const today = todayJst();
  const day = (d: number) => todayJst(new Date(Date.now() + d * 864e5));

  // 夜間作業: 直近の夜と、その前の夜(動いた夜だけ数える)
  const ns = [...(await nights())].filter(([, rows]) => rows.some((r) => r.tokens));
  const [prev, last] = ns.slice(-2).map(([night, rows]) => ({ night, ...nightSummary(rows) }));
  out.push("■ 夜間作業(metrics/laps、動いた夜の直近2晩)");
  if (last) {
    const line = (s: typeof last) => `${s.night}: ${fmt(s.tokens)}トークン・${s.episodes}本(言語含む)・平均${s.avgRounds?.toFixed(1) ?? "-"}周・7日枠+${s.sevenDayDelta ?? "-"}%`;
    out.push(`・前回 ${prev ? line(prev) : "なし"}`);
    out.push(`・直近 ${line(last)}${prev ? diff(prev.tokens, last.tokens) : ""}`);
    if (last.heaviest) out.push(`・一番重かった係: ${last.heaviest[0]}(${fmt(last.heaviest[1])}トークン)`);
  } else out.push("・記録なし");

  // 売上側: 直近2回の reach
  const rs = await reaches();
  const [rp, rl] = rs.slice(-2);
  out.push(`■ 売上に直結する数字(metrics/reach、直近 ${rl?.date ?? "なし"}${rp ? `、前回 ${rp.date}` : ""})`);
  if (rl) {
    const row = (label: string, k: keyof typeof rl) => {
      const a = rp ? (rp[k] as number | null) : null, b = rl[k] as number | null;
      out.push(`・${label}: ${b === null ? "未記録" : fmt(b) + diff(a, b)}`);
    };
    row("Instagram フォロワー(全言語)", "igFollowers");
    row("Instagram 再生(全リール)", "igPlays");
    row("TikTok 再生(全動画)", "ttViews");
    row("note PV", "notePV");
    row("note 売上(件)", "noteSales");
    row("Substack 購読者(全言語)", "substackSubs");
    const age = Math.round((Date.parse(today) - Date.parse(rl.date)) / 864e5);
    if (age > 3) out.push(`・⚠ 数字の記録が${age}日前。sugoi-shorts CLAUDE.md「その日の最初のセッション」の記録が止まっている`);
  }
  const [w1, w0] = [await published(day(-14), day(-7)), await published(day(-7), day(1))];
  const outlets = [...new Set([...Object.keys(w1), ...Object.keys(w0)])].sort();
  out.push(`・出した本数(直近7日/その前7日): ${outlets.map((o) => `${o} ${w0[o] ?? 0}/${w1[o] ?? 0}`).join("・") || "なし"}`);

  // 改善の案(kaizen)と、その数字
  const { due, later } = await openTasks();
  const kz = [...due, ...later].filter((x) => x.kind === "kaizen");
  if (!brief || kz.length) {
    out.push(`■ 進行中の改善(${kz.length}件、hq/tasks.json kind=kaizen。動かす数字と今の値を書いてから始める)`);
    for (const x of kz) out.push(`・[${x.project}] ${x.text.slice(0, 70)} / 数字: ${x.measure ?? "未記入"} / 始めた時: ${x.baseline ?? "未記入"} {${x.id}}`);
  }
  return out;
}

if (import.meta.main) {
  console.log(`# PDCA(${todayJst()})`);
  for (const l of await pdcaLines()) console.log(l);
}
