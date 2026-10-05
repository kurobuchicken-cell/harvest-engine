import { politeFetch } from "../../lib/politeness";
import type { CatalogMaker } from "../../factory/kinds/catalog";
import type { GachaItem } from "./types";
import { decodeEntities, sleep, toReleaseMonth, weekStart } from "./months";

const CALENDAR_URL = "https://www.takaratomy-arts.co.jp/items/gacha/calendar/";
const ITEM_BASE = "https://www.takaratomy-arts.co.jp/items/item.html?n=";
// 一覧に価格が無く詳細ページを読む必要がある。politeFetchは間隔を空けないため待機を入れる
const DETAIL_INTERVAL_MS = 1000;

interface Parsed {
  code: string;
  name: string;
  releaseLabelJa: string;
  day: number | null;
}

export function parseCalendar(html: string, ym: string): Parsed[] {
  // 存在しない月を指定すると別の月が返る可能性があるため、表示中の年月を照合する
  const shown = html.match(/class="year_month black">(\d{4})\.(\d{1,2})</);
  if (!shown || `${shown[1]}${shown[2].padStart(2, "0")}` !== ym) return [];
  const out: Parsed[] = [];
  for (const group of html.split('<div class="group').slice(1)) {
    const heading = group.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
    const label = decodeEntities(heading.replace(/<[^>]+>/g, "")).replace(/\s+/g, "");
    const day = label.match(/月(\d{1,2})日週/)?.[1];
    for (const m of group.matchAll(/item\.html\?n=([A-Za-z0-9]+)"[\s\S]*?<p class="black">([\s\S]*?)<\/p>/g)) {
      out.push({ code: m[1], name: decodeEntities(m[2]).replace(/\s+/g, " ").trim(), releaseLabelJa: label, day: day ? Number(day) : null });
    }
  }
  return out;
}

export function parsePrice(detailHtml: string): number | null {
  const m = detailHtml.match(/価格[:：]\s*([\d,]+)円/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export const takaraTomyArtsMaker: CatalogMaker<GachaItem> = {
  id: "takaratomy-arts",
  async collectMonth(ym, store, now) {
    const res = await politeFetch(`${CALENDAR_URL}?ym=${ym}`);
    if (res.status !== 200 || !res.body) throw new Error(`fetch failed status=${res.status} ${res.error ?? ""}`);
    const parsed = parseCalendar(res.body.toString("utf-8"), ym);
    let detailFetched = 0;
    for (const p of parsed) {
      const id = `takaratomy-arts:${p.code}`;
      const prev = store.get(id);
      let priceYen = prev?.priceYen ?? null;
      if (!prev) {
        await sleep(DETAIL_INTERVAL_MS);
        const detail = await politeFetch(`${ITEM_BASE}${p.code}`);
        if (detail.status === 200 && detail.body) priceYen = parsePrice(detail.body.toString("utf-8"));
        detailFetched++;
      }
      store.set(id, {
        id,
        maker: "takaratomy-arts",
        nameJa: p.name,
        url: `${ITEM_BASE}${p.code}`,
        priceYen,
        releaseMonth: toReleaseMonth(ym),
        releaseLabelJa: p.releaseLabelJa,
        releaseWeekStart: p.day ? weekStart(ym, p.day) : null,
        isResale: false,
        franchise: prev?.franchise ?? null,
        category: prev?.category ?? null,
        translations: prev && prev.nameJa === p.name ? prev.translations : {},
        enrichedAt: prev && prev.nameJa === p.name ? prev.enrichedAt : null,
        firstSeenAt: prev?.firstSeenAt ?? now,
        lastSeenAt: now,
      });
    }
    console.log(`[tta] ym=${ym} items=${parsed.length} detailFetched=${detailFetched}`);
    return parsed.length;
  },
};
