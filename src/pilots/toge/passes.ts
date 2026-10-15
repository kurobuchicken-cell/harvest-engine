import passesJson from "./passes.json";
import type { PassMaster, PassState, RowStatus, TogePage, TogeRow } from "./types";

// 峠マスタ。要確認の行(data/pilots/toge/review.json)をmaster.tsで追加し、GMが差分を確認してコミットする。
// ここに無い行は公開も通知もしない(誤った峠に通知を送らないため)。idはアプリの通知登録が参照するため、一度付けたら変えない
export const PASSES: PassMaster[] = passesJson as PassMaster[];

export function normalizeKey(publisherId: string, route: string, section: string): string {
  const norm = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[\s・、,()（）「」]/g, "")
      .replace(/[〜～~\-－‐―ー→]+/g, "~");
  return `${publisherId}|${norm(route)}|${norm(section)}`;
}

// 名寄せの比較用。AIは同じ区間でも書き写すたびに郡名・「地内」・「から〜まで」の有無が変わる(群馬の2026年度の発表で全行が外れた)ため、
// それらを落としてから比べる。保存済みのキーにも同じ処理をかけるので、idの元になるnormalizeKeyは変えない
export function canonicalKey(key: string): string {
  return key
    .split("|")
    .map((part, i) =>
      i === 0
        ? part
        : part
            .replace(/から/g, "~")
            .replace(/[一-龥ァ-ヶ]{1,4}郡(?=[一-龥ぁ-んァ-ヶ])/g, "")
            .replace(/地内|地先|付近|まで|一般|主要地方道|地方道|県道|道道/g, "")
            .replace(/~+/g, "~")
            .replace(/^~|~$/g, ""),
    )
    .join("|");
}

const bigrams = (s: string) => new Set([...Array(Math.max(s.length - 1, 0))].map((_, i) => s.slice(i, i + 2)));
export function similarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.size === 0 || y.size === 0) return a === b ? 1 : 0;
  let inter = 0;
  for (const g of x) if (y.has(g)) inter++;
  return inter / (x.size + y.size - inter);
}

// 路線名はAIが「607号」「607号石崎松前線」「水上片品線63号」のように書き分けるため、包含か路線番号の一致で同じ路線とみなす
export function sameRoute(a: string, b: string): boolean {
  if (a === b || (a.length >= 2 && b.includes(a)) || (b.length >= 2 && a.includes(b))) return true;
  const num = (s: string) => /(\d+)号/.exec(s)?.[1] ?? null;
  return num(a) !== null && num(a) === num(b);
}

const FUZZY_MIN = 0.5;
const FUZZY_MARGIN = 0.15;

// 完全一致しない行は、同じ発行元・同じ路線の峠の中で区間の文字の重なりが最も大きいものに結びつける。
// 誤った峠に通知しないよう、十分に重なり、かつ2番目との差がはっきりある時だけ採る
export function fuzzyMatch(key: string, masters: PassMaster[]): PassMaster | null {
  const [pub, route, section] = canonicalKey(key).split("|");
  const scored = masters
    .map((m) => {
      const best = Math.max(
        ...m.keys.map((k) => {
          const [mp, mr, ms] = canonicalKey(k).split("|");
          return mp === pub && sameRoute(mr, route) ? similarity(ms, section) : 0;
        }),
      );
      return { m, score: best };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0 || scored[0].score < FUZZY_MIN) return null;
  if (scored.length > 1 && scored[0].score - scored[1].score < FUZZY_MARGIN) return null;
  return scored[0].m;
}

export interface ReviewRow extends TogeRow {
  key: string;
  sourceId: string;
  status: RowStatus;
}

// 日時はJSTの "YYYY-MM-DD" か "YYYY-MM-DDTHH:mm"。同じ形の文字列なので比較は文字列の大小で足りる
const STALE_DAYS = 300;

export const jstNow = (now: Date) => now.toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 16).replace(" ", "T");

// 春の解除の発表には前年の閉鎖日が年なしで書かれていることがあり、AIが発表年を補って「解除が閉鎖より前」になる(山形の記者発表)。
// 1シーズンは閉鎖→解除の順なので、その場合は閉鎖日を1年戻す
export function fixSeason(row: TogeRow): TogeRow {
  if (!row.closeAt || !row.reopenAt || row.reopenAt >= row.closeAt) return row;
  const shifted = `${Number(row.closeAt.slice(0, 4)) - 1}${row.closeAt.slice(4)}`;
  return shifted < row.reopenAt ? { ...row, closeAt: shifted } : row;
}

// 開通は発表元が解除済みと明記した時だけ。解除予定日を過ぎても明記がなければunknown(アプリでは「発表元で確認」と出す)
export function rowStatus(row: TogeRow, now: string): RowStatus {
  if (row.reopenedExplicit) return "open";
  if (row.closeAt && row.closeAt > now) return "closing_planned";
  if (row.reopenAt && row.reopenAt <= now) return "unknown";
  // 解除日の無い前シーズンの閉鎖を「閉鎖中」と出し続けないため、閉鎖から300日を過ぎたら言い切らない
  const staleBefore = new Date(Date.parse(`${now.slice(0, 10)}T00:00:00Z`) - STALE_DAYS * 86_400_000).toISOString().slice(0, 10);
  if (row.closeAt && row.closeAt < staleBefore) return "unknown";
  return row.closeAt || row.reopenAt ? "closed" : "unknown";
}

export interface MatchResult {
  states: Map<string, PassState>;
  unmatched: ReviewRow[];
  conflicts: { passId: string; rows: ReviewRow[] }[];
}

const pageTime = (p: TogePage) => p.announcedAt ?? p.changedAt ?? "";

export function matchRows(pages: TogePage[], now: Date, masters: PassMaster[] = PASSES): MatchResult {
  const nowJst = jstNow(now);
  const byKey = new Map<string, PassMaster>();
  for (const m of masters) for (const k of m.keys) byKey.set(canonicalKey(k), m);

  const matched = new Map<string, { row: ReviewRow; page: TogePage }[]>();
  const unmatched: ReviewRow[] = [];
  for (const page of pages) {
    for (const raw of page.rows) {
      const row = fixSeason(raw);
      const key = normalizeKey(page.publisherId, row.route, row.section);
      const review: ReviewRow = { ...row, key, sourceId: page.id, status: rowStatus(row, nowJst) };
      const master = byKey.get(canonicalKey(key)) ?? fuzzyMatch(key, masters);
      if (!master) {
        unmatched.push(review);
        continue;
      }
      matched.set(master.id, [...(matched.get(master.id) ?? []), { row: review, page }]);
    }
  }

  const states = new Map<string, PassState>();
  const conflicts: MatchResult["conflicts"] = [];
  for (const [passId, entries] of matched) {
    // 開通と閉鎖中のように状態そのものが食い違うときは、どちらも採らず要確認に回す
    const statuses = new Set(entries.map((e) => e.row.status).filter((s) => s !== "unknown"));
    if (statuses.has("open") && statuses.size > 1) {
      conflicts.push({ passId, rows: entries.map((e) => e.row) });
      continue;
    }
    // 日付の食い違いは発表日の新しい方を採る
    // 同じ発表に「夜間のみ→終日」のように同じ区間が2段階で載る(福島の観光道路)ため、同じ発表なら閉鎖開始の遅い本閉鎖を採る
    const latest = entries.sort(
      (a, b) => pageTime(b.page).localeCompare(pageTime(a.page)) || (b.row.closeAt ?? "").localeCompare(a.row.closeAt ?? ""),
    )[0];
    states.set(passId, {
      passId,
      status: latest.row.status,
      closeAt: latest.row.closeAt,
      reopenAt: latest.row.reopenAt,
      reopenCertainty: latest.row.reopenCertainty,
      vehicles: latest.row.vehicles,
      sourceId: latest.page.id,
      changedAt: latest.page.changedAt ?? "",
    });
  }
  return { states, unmatched, conflicts };
}
