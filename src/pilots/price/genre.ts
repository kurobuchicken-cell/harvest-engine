import type { Genre } from "../../factory/genre";
import { analyzeAnnouncements, collectAnnouncements, type AnnouncementConfig } from "../../factory/kinds/announcement";
import { ACTIVE_SOURCES } from "./sources";
import { KEYWORDS } from "./collect";
import { applyExtraction, OUTPUT_SCHEMA, SYSTEM_PROMPT, type Extraction } from "./analyze";
import { generateSite } from "./generate";
import type { PriceNotice } from "./types";

const config: AnnouncementConfig<PriceNotice, Extraction> = {
  sources: ACTIVE_SOURCES,
  linkKeywords: KEYWORDS,
  emptyFields: () => ({
    isPriceRevision: null, direction: null, title: null, summary: null, announcedAt: null, effectiveAt: null,
    rateText: null, rateMinPct: null, rateMaxPct: null, sizeChange: null, brands: [], categories: [],
  }),
  ai: { service: "pilot-price-haiku", model: "claude-haiku-4-5", system: SYSTEM_PROMPT, schema: OUTPUT_SCHEMA, maxPerRun: 40 },
  apply: applyExtraction,
  costDescription: (analyzed) => `値上げ情報パイロット: リリース${analyzed}件を抽出`,
};

export const priceGenre: Genre<PriceNotice> = {
  id: "price",
  kind: "announcement",
  collect: (store) => collectAnnouncements(config, store),
  // 停止中の社の未抽出分をAIに回さない
  enrich: (store, budget) => {
    const active = new Set(ACTIVE_SOURCES.map((s) => s.id));
    return analyzeAnnouncements(config, new Map([...store].filter(([, n]) => active.has(n.sourceId))), budget);
  },
  generate: generateSite,
};
