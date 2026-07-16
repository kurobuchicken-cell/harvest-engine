import Parser from "rss-parser";
import { politeFetch } from "../lib/politeness";
import type { FetchOutcome } from "./types";

const parser = new Parser();

export async function fetchRss(url: string): Promise<FetchOutcome> {
  const result = await politeFetch(url);
  if (!result.body) {
    return { httpStatus: result.status, raw: null, normalized: null, error: result.error };
  }

  const xml = result.body.toString("utf-8");
  try {
    const feed = await parser.parseString(xml);
    // XMLの整形差分ではなく記事の追加・変更のみを検知するため、項目情報だけを正規化して比較する
    const items = (feed.items ?? []).map((item) => ({
      title: item.title ?? null,
      link: item.link ?? null,
      guid: item.guid ?? null,
      isoDate: item.isoDate ?? item.pubDate ?? null,
    }));
    return {
      httpStatus: result.status,
      raw: result.body,
      normalized: JSON.stringify({ title: feed.title ?? null, items }),
    };
  } catch (err) {
    return {
      httpStatus: result.status,
      raw: result.body,
      normalized: null,
      error: `rss_parse_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
