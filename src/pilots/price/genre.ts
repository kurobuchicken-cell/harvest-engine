import type { Genre } from "../../factory/genre";
import { analyzeAnnouncements, collectAnnouncements, type AnnouncementConfig } from "../../factory/kinds/announcement";
import { SOURCES } from "./sources";
import { KEYWORDS } from "./collect";
import { applyExtraction, OUTPUT_SCHEMA, SYSTEM_PROMPT, type Extraction } from "./analyze";
import { generateSite } from "./generate";
import type { PriceNotice } from "./types";

const config: AnnouncementConfig<PriceNotice, Extraction> = {
  sources: SOURCES,
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
  enrich: (store, budget) => analyzeAnnouncements(config, store, budget),
  generate: generateSite,
};
