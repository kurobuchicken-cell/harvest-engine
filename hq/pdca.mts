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
// 目的は「質を落とさず、できあがり1本あたりのトークンを減らす」(2026-11-02 オーナー)。合計でなく1本あたりで見るのは、本数を減らして下がった分を削減と取り違えないため
interface Lap { at: string; night: string; episode: string; step: string; part?: string; tokens?: number; role?: string; model?: string; fiveHourPct?: number | null; sevenDayPct?: number | null }
async function nights(): Promise<Map<string, Lap[]>> {
  const dir = path.join(SUGOI, "metrics");
  const out = new Map<string, Lap[]>();
  for (const f of (await readdir(dir)).filter((f) => /^laps-\d{4}-\d\d-\d\d\.jsonl$/.test(f)).sort()) {
    const rows = (await readFile(path.join(dir, f), "utf-8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Lap);
    out.set(f.slice(5, 15), rows);
  }
  return out;
}
const LANG_SUFFIX = /-(en|es|pt|fr|it|zh|ko|de|id|ar)$/;
const LANGS = ["ja", "en", "es", "pt", "fr", "it", "zh", "ko", "de", "id", "ar"];
const langOf = (ep: string) => LANG_SUFFIX.exec(ep)?.[1] ?? "ja";
const baseOf = (ep: string) => ep.replace(LANG_SUFFIX, "");
const ROWS: [string, string][] = [["reach", "0 数字の記録"], ["article-ja", "1 記事(日本語)"], ["article-tr", "2 記事の翻訳"], ["neta", "3 ネタ集め"], ["video-ja", "4 動画(日本語)"], ["video-tr", "4 動画(外国語)"], ["post", "5 朝の投稿"], ["wrapup", "6 記録と報告"], ["promo", "7 プロモーション(金曜)"], ["ideas", "8 新しい儲け口の仮説と検証"], ["?", "分けられない"]];
// part の無い記録(2026-11-02 より前と付け忘れ)は、同じ夜にその本の声・画面の工程があれば動画、なければ記事とみなす
function partOf(r: Lap, rows: Lap[]): string {
  if (r.part) return r.part;
  if (["reach", "post", "wrapup"].includes(r.episode)) return r.episode;
  if (/^promo/.test(r.episode)) return "promo";
  if (/^neta/.test(r.episode) || /^neta/.test(r.step)) return "neta";
  if (r.episode === "-") return "?";
  const b = baseOf(r.episode);
  return rows.some((x) => baseOf(x.episode) === b && /^(voice|preview|viewer|render)/.test(x.step)) ? "video" : "article";
}
const rowOf = (r: Lap, rows: Lap[]) => { const p = partOf(r, rows); return p === "article" || p === "video" ? `${p}-${langOf(r.episode) === "ja" ? "ja" : "tr"}` : p; };
const minutesOf = (spans: [number, number][]) => {
  let total = 0, end = -Infinity;
  for (const [a, b] of spans.sort((x, y) => x[0] - y[0])) { if (b > end) { total += b - Math.max(a, end); end = b; } }
  return Math.round(total / 60000);
};
function nightSummary(rows: Lap[]) {
  const tokens = rows.reduce((a, r) => a + (r.tokens ?? 0), 0);
  const eps = new Set(rows.filter((r) => r.episode && !/^(session|start|end|-|neta|reach|post|wrapup|promo)(-|$)/.test(r.episode)).map((r) => r.episode));
  const rounds = new Map<string, number>();
  for (const r of rows) {
    const m = /^check-(\d+)$/.exec(r.step);
    if (m) rounds.set(r.episode, Math.max(rounds.get(r.episode) ?? 0, Number(m[1])));
  }
  const pct = rows.map((r) => r.sevenDayPct).filter((x): x is number => typeof x === "number");
  const byRole = new Map<string, number>();
  for (const r of rows) if (r.role) byRole.set(r.role, (byRole.get(r.role) ?? 0) + (r.tokens ?? 0));
  const heaviest = [...byRole].sort((a, b) => b[1] - a[1])[0];
  // 行ごと: トークン・本(言語)の数・時間(並行した分は重ねて数えない)・5時間枠の増え(トークンの記録が無い GM の作業の目安)
  const byRow = new Map<string, { tokens: number; eps: Set<string>; spans: [number, number][]; fiveH: number; rounds: number[] }>();
  const spanOf = new Map<string, Lap[]>();
  // episode "-" はセッションの区切りの印で、夜じゅうにまたがるので行にも時間にも数えない
  for (const r of rows.filter((r) => r.episode !== "-")) {
    const k = rowOf(r, rows);
    const v = byRow.get(k) ?? { tokens: 0, eps: new Set<string>(), spans: [], fiveH: 0, rounds: [] };
    v.tokens += r.tokens ?? 0;
    if (k !== "?" && k !== "neta" && k !== "reach" && k !== "post" && k !== "wrapup" && k !== "promo") v.eps.add(r.episode);
    byRow.set(k, v);
    const sk = `${k}\t${r.episode}`;
    spanOf.set(sk, [...(spanOf.get(sk) ?? []), r]);
  }
  for (const [sk, rs] of spanOf) {
    const v = byRow.get(sk.split("\t")[0])!;
    v.spans.push([Date.parse(rs[0].at), Date.parse(rs[rs.length - 1].at)]);
    const a = rs[0].fiveHourPct, b = rs[rs.length - 1].fiveHourPct;
    if (typeof a === "number" && typeof b === "number" && b >= a) v.fiveH += b - a;
  }
  for (const [ep, n] of rounds) byRow.get(rowOf(rows.find((r) => r.episode === ep)!, rows))?.rounds.push(n);
  // 言語ごと: 記事・動画のトークンと本数(言語を対象から外すかの判断に使う)
  const byLang = new Map<string, { article: number; articleEps: Set<string>; video: number; videoEps: Set<string> }>();
  for (const r of rows) {
    const p = partOf(r, rows);
    if (p !== "article" && p !== "video") continue;
    const l = langOf(r.episode);
    const v = byLang.get(l) ?? { article: 0, articleEps: new Set<string>(), video: 0, videoEps: new Set<string>() };
    if (p === "article") { v.article += r.tokens ?? 0; v.articleEps.add(r.episode); } else { v.video += r.tokens ?? 0; v.videoEps.add(r.episode); }
    byLang.set(l, v);
  }
  const t = (k: string) => byRow.get(k)?.tokens ?? 0;
  // 日本語の記事は訳まで行かずに落ちる本もあるので、日本語1本と訳1言語を分けて割る
  const per = (k: string) => { const n = byRow.get(k)?.eps.size ?? 0; return n ? Math.round(t(k) / n) : null; };
  const videoLangs = (byRow.get("video-ja")?.eps.size ?? 0) + (byRow.get("video-tr")?.eps.size ?? 0);
  const perArticle = per("article-ja"), perTranslation = per("article-tr");
  const perVideoLang = videoLangs ? Math.round((t("video-ja") + t("video-tr")) / videoLangs) : null;
  const avgRounds = rounds.size ? [...rounds.values()].reduce((a, b) => a + b, 0) / rounds.size : null;
  return { tokens, episodes: eps.size, avgRounds, sevenDayDelta: pct.length ? Math.max(...pct) - Math.min(...pct) : null, heaviest, byRow, byLang, perArticle, perTranslation, perVideoLang };
}
// その夜(12時〜翌12時)に「出さない」にした本の数(質の目安。合格できずに捨てた本)
async function droppedIn(night: string) {
  const dir = path.join(SUGOI, "episodes");
  const from = `${night} 12:00`, to = `${todayJst(new Date(Date.parse(night) + 864e5))} 12:00`;
  let n = 0;
  for (const d of await readdir(dir)) {
    const ep = await readJson(path.join(dir, d, "episode.json")).catch(() => null);
    if (ep?.stage === "dropped" && String(ep.stageAt ?? "") >= from && String(ep.stageAt ?? "") < to) n++;
  }
  return n;
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
  return Promise.all(files.map(async (f) => ({ date: f.slice(6, 16), file: f, ...reachSummary(await readJson(path.join(dir, f))) })));
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
  const all = [...(await nights())].filter(([, rows]) => rows.some((r) => r.tokens));
  const [prev, last] = all.slice(-2).map(([night, rows]) => ({ night, ...nightSummary(rows) }));
  const man = (n: number) => `${(n / 1e4).toFixed(n >= 1e6 ? 0 : 1)}万`;
  const cmp = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || !a ? "" : `(前回比 ${b >= a ? "+" : ""}${Math.round(((b - a) / a) * 100)}%)`);
  out.push("■ 夜間作業(metrics/laps、動いた夜の直近2晩。目的: 質を落とさず1本あたりのトークンを減らす)");
  if (last) {
    const line = (s: typeof last) => `${s.night}: ${fmt(s.tokens)}トークン・${s.episodes}本(言語含む)・平均${s.avgRounds?.toFixed(1) ?? "-"}周・7日枠+${s.sevenDayDelta ?? "-"}%`;
    out.push(`・前回 ${prev ? line(prev) : "なし"}`);
    out.push(`・直近 ${line(last)}${prev ? diff(prev.tokens, last.tokens) : ""}`);
    const u = (v: number | null) => (v == null ? "-" : man(v));
    out.push(`・1本あたり: 記事の日本語1本 ${u(last.perArticle)}${cmp(prev?.perArticle, last.perArticle)}・記事の訳1言語 ${u(last.perTranslation)}${cmp(prev?.perTranslation, last.perTranslation)}・動画1言語 ${u(last.perVideoLang)}${cmp(prev?.perVideoLang, last.perVideoLang)}`);
    const [dPrev, dLast] = [prev ? await droppedIn(prev.night) : null, await droppedIn(last.night)];
    const rnd = (s: typeof last | undefined, k: string) => { const r = s?.byRow.get(k)?.rounds ?? []; return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1) : "-"; };
    out.push(`・質: 合格までの平均の周 記事${rnd(last, "article-ja")}(前回${rnd(prev, "article-ja")})・動画日本語${rnd(last, "video-ja")}(前回${rnd(prev, "video-ja")})・動画外国語${rnd(last, "video-tr")}(前回${rnd(prev, "video-tr")})/出さないにした本 ${dLast}(前回${dPrev ?? "-"})`);
    if (last.heaviest) out.push(`・一番重かった係: ${last.heaviest[0]}(${fmt(last.heaviest[1])}トークン)`);
    if (!brief) {
      out.push("・行ごと(トークン・時間・本数。前回):");
      const cell = (x: ReturnType<typeof nightSummary>["byRow"] extends Map<string, infer V> ? V | undefined : never) =>
        x ? `${x.tokens ? man(x.tokens) : `トークン記録なし・5時間枠+${x.fiveH}%`}・${minutesOf([...x.spans])}分${x.eps.size ? `・${x.eps.size}本` : ""}` : "なし";
      for (const [k, label] of ROWS) {
        const v = last.byRow.get(k), p = prev?.byRow.get(k);
        if (!v && !p) { if (k !== "?") out.push(`  ${label}: 記録なし`); continue; }
        out.push(`  ${label}: ${cell(v)}(前回 ${cell(p)})`);
      }
    }
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

  // 言語ごと(直近7晩): かかったトークンと届いた数字を並べ、言語を対象から外すかの判断に使う
  if (!brief && all.length) {
    const week = all.filter(([n]) => n > day(-8));
    const agg = new Map<string, { article: number; aEps: Set<string>; video: number; vEps: Set<string> }>();
    for (const [, rows] of week) for (const [l, v] of nightSummary(rows).byLang) {
      const a = agg.get(l) ?? { article: 0, aEps: new Set<string>(), video: 0, vEps: new Set<string>() };
      a.article += v.article; v.articleEps.forEach((e) => a.aEps.add(e)); a.video += v.video; v.videoEps.forEach((e) => a.vEps.add(e));
      agg.set(l, a);
    }
    const reachRaw = rl ? await readJson(path.join(SUGOI, "metrics", rl.file)) : null;
    out.push(`■ 言語ごと(直近7晩のトークン、届いた数字は ${rl?.date ?? "なし"}。言語を対象から外すかの判断に使う)`);
    const per = (t: number, n: number) => (n ? `${man(t)}(${n}本・1本${man(Math.round(t / n))})` : "-");
    for (const l of LANGS) {
      const a = agg.get(l);
      let reach = "";
      if (l === "ja") reach = rl ? `note PV ${rl.notePV ?? "-"}・売上 ${rl.noteSales ?? "-"}件` : "";
      else {
        const pub = reachRaw?.substack?.publications?.[l];
        if (pub) reach = `Substack 30日閲覧 ${pub.views30d ?? "-"}・購読 無料${pub.freeSubscribers ?? "-"}/有料${pub.paidSubscribers ?? "-"}`;
      }
      out.push(`・${l}: 記事 ${a ? per(a.article, a.aEps.size) : "-"}・動画 ${a ? per(a.video, a.vEps.size) : "-"}${reach ? ` / ${reach}` : ""}`);
    }
  }

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
