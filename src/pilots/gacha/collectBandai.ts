import { politeFetch } from "../../lib/politeness";
import type { GachaItem } from "./types";
import { decodeEntities, toReleaseMonth } from "./months";

const SCHEDULE_URL = "https://gashapon.jp/schedule/";
const DETAIL_BASE = "https://gashapon.jp/products/detail.php?jan_code=";

const stripTags = (s: string) => decodeEntities(s.replace(/<small[\s\S]*?<\/small>/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, "");

interface Parsed {
  code: string;
  name: string;
  priceYen: number | null;
  isResale: boolean;
  releaseLabelJa: string;
}

// スケジュール欄(pg-data__schedule)以外にもランキング等の商品リンクがあるため、週見出し単位で切り出して読む
export function parseSchedule(html: string): Parsed[] {
  const start = html.indexOf('class="pg-data__schedule"');
  if (start < 0) return [];
  const blocks = html.slice(start).split('<div class="week">').slice(1);
  const out: Parsed[] = [];
  for (const block of blocks) {
    const label = stripTags(block.match(/<div class="pg-tit__week">([\s\S]*?)<\/div>/)?.[1] ?? "");
    for (const card of block.split('class="c-card__list').slice(1)) {
      const link = card.match(/detail\.php\?jan_code=(\d+)"[^>]*alt="([^"]*)"/);
      if (!link) continue;
      const name = decodeEntities(card.match(/<p class="c-card__name">([\s\S]*?)<\/p>/)?.[1] ?? link[2]).replace(/\s+/g, " ").trim();
      const price = card.match(/c-card__price--main">([\d,]+)</)?.[1];
      out.push({
        code: link[1],
        name,
        priceYen: price ? Number(price.replace(/,/g, "")) : null,
        isResale: card.includes("c-card__resale--txt"),
        releaseLabelJa: label,
      });
    }
  }
  return out;
}

export async function collectBandai(store: Map<string, GachaItem>, months: string[]): Promise<number> {
  const now = new Date().toISOString();
  let seen = 0;
  for (const ym of months) {
    const res = await politeFetch(`${SCHEDULE_URL}?ym=${ym}`);
    if (res.status !== 200 || !res.body) {
      console.error(`[bandai] ym=${ym} fetch failed status=${res.status} ${res.error ?? ""}`);
      continue;
    }
    const parsed = parseSchedule(res.body.toString("utf-8"));
    for (const p of parsed) {
      const id = `bandai:${p.code}`;
      const prev = store.get(id);
      store.set(id, {
        id,
        maker: "bandai",
        nameJa: p.name,
        url: `${DETAIL_BASE}${p.code}`,
        priceYen: p.priceYen,
        releaseMonth: toReleaseMonth(ym),
        releaseLabelJa: p.releaseLabelJa,
        releaseWeekStart: null,
        isResale: p.isResale,
        franchise: prev?.franchise ?? null,
        category: prev?.category ?? null,
        translations: prev && prev.nameJa === p.name ? prev.translations : {},
        enrichedAt: prev && prev.nameJa === p.name ? prev.enrichedAt : null,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastSeenAt: now,
      });
    }
    seen += parsed.length;
    console.log(`[bandai] ym=${ym} items=${parsed.length}`);
  }
  return seen;
}
