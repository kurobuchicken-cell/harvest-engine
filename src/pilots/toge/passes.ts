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
  for (const m of masters) for (const k of m.keys) byKey.set(k, m);

  const matched = new Map<string, { row: ReviewRow; page: TogePage }[]>();
  const unmatched: ReviewRow[] = [];
  for (const page of pages) {
    for (const raw of page.rows) {
      const row = fixSeason(raw);
      const key = normalizeKey(page.publisherId, row.route, row.section);
      const review: ReviewRow = { ...row, key, sourceId: page.id, status: rowStatus(row, nowJst) };
      const master = byKey.get(key);
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
