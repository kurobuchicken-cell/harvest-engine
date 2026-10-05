import { politeFetch } from "../../lib/politeness";
import type { SourceReport } from "../genre";

// 補助金型: 公開APIの一覧を取り、新しい・変わった項目だけ詳細APIを呼ぶ。情報源の追加は、一覧の取り方・
// 変化の判定・詳細から項目を作る関数を書くだけでよい
export interface ApiSource<L, T> {
  id: string;
  list(): Promise<L[]>;
  storeId(entry: L): string;
  // trueなら詳細を取り直さない(既知で変化なし)
  isUnchanged(prev: T, entry: L): boolean;
  touch(prev: T, now: string): void;
  fetchDetail(entry: L, prev: T | undefined, now: string): Promise<T>;
  // politeFetchはホスト直列化のみで間隔を空けないため、詳細APIの連続呼び出しに待機を入れる
  detailIntervalMs: number;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getJson<T>(url: string): Promise<T> {
  const res = await politeFetch(url);
  if (res.status !== 200 || !res.body) {
    throw new Error(`fetch failed: status=${res.status} error=${res.error ?? ""} url=${url}`);
  }
  return JSON.parse(res.body.toString("utf-8")) as T;
}

// 一覧の取得失敗は例外のまま返す(呼び出し側で情報源の失敗として記録する)。詳細の個別失敗はその項目だけ飛ばす
export async function collectApi<L, T>(source: ApiSource<L, T>, store: Map<string, T>): Promise<SourceReport> {
  const now = new Date().toISOString();
  const entries = await source.list();
  let fetched = 0;
  for (const entry of entries) {
    const id = source.storeId(entry);
    const prev = store.get(id);
    if (prev && source.isUnchanged(prev, entry)) {
      source.touch(prev, now);
      continue;
    }
    await sleep(source.detailIntervalMs);
    try {
      store.set(id, await source.fetchDetail(entry, prev, now));
      fetched++;
    } catch (err) {
      console.error(`[${source.id}] detail failed id=${id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`[${source.id}] open=${entries.length} detailFetched=${fetched}`);
  return { sourceId: source.id, seen: entries.length, ok: true };
}
