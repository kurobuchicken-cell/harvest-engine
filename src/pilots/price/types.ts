import type { AnnouncementBase } from "../../factory/kinds/announcement";

export type Direction = "increase" | "decrease" | "mixed" | "size_only" | "other";

export interface PriceNotice extends AnnouncementBase {
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
}
