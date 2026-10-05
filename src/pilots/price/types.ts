export type Direction = "increase" | "decrease" | "mixed" | "size_only" | "other";

export interface PriceNotice {
  id: string; // URLのハッシュ
  sourceId: string;
  company: string;
  url: string;
  linkText: string; // 一覧ページのリンク文言(抽出対象の判定に使った文字列。ページには出さない)
  listOrder: number; // 一覧での掲載順(小さいほど新しい)。1回のAI処理件数を絞るときの優先度に使う
  status: "pending" | "analyzed" | "error";
  errorCount: number;
  lastError: string | null;
  isPriceRevision: boolean | null;
  direction: Direction | null;
  title: string | null; // AIが書いた中立的な見出し(本文の転載はしない)
  summary: string | null;
  announcedAt: string | null;
  effectiveAt: string | null;
  rateText: string | null;
  rateMinPct: number | null;
  rateMaxPct: number | null;
  sizeChange: boolean | null;
  brands: string[];
  categories: string[];
  discoveredAt: string;
  analyzedAt: string | null;
}
