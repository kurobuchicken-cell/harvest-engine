import type { AiBudget } from "./ai";

// 型: catalog=メーカーの新作一覧を月ごとに読む / announcement=各社のお知らせ一覧から特定の告知を拾う / api=公開APIの一覧+詳細
export type GenreKind = "catalog" | "announcement" | "api";

// 情報源ごとの収集結果。seenは「一覧で見えた件数」(新規件数ではない)で、急減の検知に使う
export interface SourceReport {
  sourceId: string;
  seen: number;
  ok: boolean;
  error?: string;
}

export interface GenerateResult {
  outDir: string;
  pages: number;
  listed: number;
}

export interface Genre<T extends { id: string }> {
  id: string;
  kind: GenreKind;
  collect(store: Map<string, T>): Promise<SourceReport[]>;
  enrich?(store: Map<string, T>, budget: AiBudget): Promise<void>;
  // 収集の有無に関わらずページ生成前に毎回行う後処理(分類表を直したときの再正規化など)
  prepare?(store: Map<string, T>): void;
  generate(store: Map<string, T>, now: Date): Promise<GenerateResult>;
}

export function sourceFailure(sourceId: string, err: unknown): SourceReport {
  const error = err instanceof Error ? err.message : String(err);
  console.error(`[${sourceId}] failed: ${error}`);
  return { sourceId, seen: 0, ok: false, error };
}
