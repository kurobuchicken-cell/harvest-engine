import { fetchHtml } from "./html";
import { fetchJson } from "./json";
import { fetchRss } from "./rss";
import { fetchPdf } from "./pdf";
import type { FetchOutcome } from "./types";

export type { FetchOutcome } from "./types";

export async function fetchByType(fetchType: string, url: string): Promise<FetchOutcome> {
  switch (fetchType) {
    case "html":
      return fetchHtml(url);
    case "json":
      return fetchJson(url);
    case "rss":
      return fetchRss(url);
    case "pdf":
      return fetchPdf(url);
    default:
      // 'puppeteer' は今回未実装。active=falseのソースはそもそも巡回対象から除外される
      return { httpStatus: null, raw: null, normalized: null, error: `unsupported_fetch_type: ${fetchType}` };
  }
}
