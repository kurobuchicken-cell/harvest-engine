export type MakerId = "bandai" | "takaratomy-arts";

export interface GachaTranslation {
  name: string;
}

export interface GachaItem {
  id: string; // `${maker}:${メーカーの商品コード}`
  maker: MakerId;
  nameJa: string;
  url: string;
  priceYen: number | null;
  releaseMonth: string; // "YYYY-MM"
  releaseLabelJa: string; // 公式表記のまま(例: "10月第1週より順次"、"10月5日週発売")
  releaseWeekStart: string | null; // 発売週の開始日 "YYYY-MM-DD"(分かる場合のみ)
  isResale: boolean;
  // 作品名は英語の正式表記で統一する(言語別ページのslugにも使うため)
  franchise: string | null;
  category: string | null; // enrich.tsのCATEGORIESの値
  translations: Record<string, GachaTranslation>; // 言語コード→翻訳(ja以外)
  enrichedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}
