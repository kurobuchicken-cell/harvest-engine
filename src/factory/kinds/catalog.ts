import type { SourceReport } from "../genre";

// ガチャ型: メーカーの新作一覧(発売スケジュール)を月ごとに読む。メーカーの追加は、1か月分の一覧を読んで
// ストアに入れる関数(collectMonth)を1つ書くだけでよい
export interface CatalogMaker<T> {
  id: string;
  // ym="YYYYMM"。一覧で見えた件数を返す。取得失敗は例外で知らせる(その月だけ飛ばして他の月・他のメーカーは続ける)
  collectMonth(ym: string, store: Map<string, T>, now: string): Promise<number>;
}

// 収集対象は前月・当月・翌月(JST基準)。発売済みの直近分と発表済みの次月分を拾うため
export function targetMonths(now = new Date()): string[] {
  const [y, m] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).split("-").map(Number);
  return [-1, 0, 1].map((offset) => {
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function collectCatalog<T>(makers: CatalogMaker<T>[], store: Map<string, T>, months = targetMonths()): Promise<SourceReport[]> {
  const now = new Date().toISOString();
  const reports: SourceReport[] = [];
  for (const maker of makers) {
    let seen = 0;
    const errors: string[] = [];
    for (const ym of months) {
      try {
        seen += await maker.collectMonth(ym, store, now);
      } catch (err) {
        const message = `ym=${ym} ${err instanceof Error ? err.message : err}`;
        console.error(`[${maker.id}] ${message}`);
        errors.push(message);
      }
    }
    reports.push({ sourceId: maker.id, seen, ok: errors.length === 0, ...(errors.length > 0 ? { error: errors.join(" / ") } : {}) });
  }
  return reports;
}
