import { createHash } from "node:crypto";
import type { PriceNotice } from "./types";
import { SOURCES, type PriceSource } from "./sources";
import { decodeHtml, fetchWithTimeout } from "./fetchUtil";

// 値上げの告知はリンク文言にこれらの語を含む。社ごとの専用パーサーを持たず、この判定だけで全社を共通に扱う
const KEYWORDS = /価格改定|価格改訂|値上げ|出荷価格|価格の改定|価格変更|価格の見直し|内容量変更|規格変更/;

export function extractNoticeLinks(html: string, baseUrl: string): { url: string; text: string }[] {
  const seen = new Set<string>();
  const out: { url: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!KEYWORDS.test(text)) continue;
    let url: string;
    try {
      url = new URL(m[1].replace(/&amp;/g, "&"), baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, text: text.slice(0, 200) });
  }
  return out;
}

export const noticeId = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

async function collectSource(source: PriceSource, store: Map<string, PriceNotice>, now: string): Promise<number> {
  const res = await fetchWithTimeout(source.listUrl);
  if (res.status !== 200 || !res.body) {
    console.error(`[collect] ${source.company} list failed status=${res.status} ${res.error ?? ""}`);
    return 0;
  }
  const links = extractNoticeLinks(decodeHtml(res.body), source.listUrl);
  let added = 0;
  links.forEach((link, index) => {
    const id = noticeId(link.url);
    if (store.has(id)) return;
    store.set(id, {
      id, sourceId: source.id, company: source.company, url: link.url, linkText: link.text, listOrder: index,
      status: "pending", errorCount: 0, lastError: null,
      isPriceRevision: null, direction: null, title: null, summary: null, announcedAt: null, effectiveAt: null,
      rateText: null, rateMinPct: null, rateMaxPct: null, sizeChange: null, brands: [], categories: [],
      discoveredAt: now, analyzedAt: null,
    });
    added++;
  });
  console.log(`[collect] ${source.company} matched=${links.length} new=${added}`);
  return added;
}

export async function collectAll(store: Map<string, PriceNotice>): Promise<number> {
  const now = new Date().toISOString();
  // 各社のホストは全て異なるため並列で取得してよい(同一ホストの直列化はpoliteFetch側が担保)
  const counts = await Promise.all(
    SOURCES.map((s) =>
      collectSource(s, store, now).catch((err) => {
        console.error(`[collect] ${s.company} failed: ${err instanceof Error ? err.message : err}`);
        return 0;
      }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}
