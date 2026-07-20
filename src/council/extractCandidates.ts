import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";
import { prisma } from "../lib/prisma";
import { politeFetch } from "../lib/politeness";
import type { CandidateItem } from "./types";

const WINDOW_DAYS = 7;
// トークン予算を守るための技術的な上限(内容の良し悪しでの絞り込みではない)。
// どのアイテムが有望かの判断は一切ここでは行わず、すべて選定評議会(selectCandidates.ts)に委ねる
const MAX_ITEMS = 500;

const rssParser = new Parser();

async function readRawGz(rawPath: string): Promise<Buffer> {
  const absPath = path.resolve(process.cwd(), rawPath);
  const gz = await readFile(absPath);
  return gunzipSync(gz);
}

async function itemsFromRss(raw: Buffer, sourceCompanyName: string): Promise<CandidateItem[]> {
  const xml = raw.toString("utf-8");
  const feed = await rssParser.parseString(xml);
  return (feed.items ?? [])
    .filter((item) => item.title && item.link)
    .map((item) => ({
      title: item.title!,
      url: item.link!,
      sourceCompanyName,
      publishedAt: item.isoDate ?? item.pubDate,
    }));
}

async function itemsFromHnIdList(raw: Buffer, sourceCompanyName: string): Promise<CandidateItem[]> {
  const ids: number[] = JSON.parse(raw.toString("utf-8"));
  const items: CandidateItem[] = [];
  for (const id of ids) {
    const result = await politeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    if (!result.body) continue;
    try {
      const parsed = JSON.parse(result.body.toString("utf-8"));
      if (!parsed?.title) continue;
      const url = parsed.url ?? `https://news.ycombinator.com/item?id=${id}`;
      const publishedAt = parsed.time ? new Date(parsed.time * 1000).toISOString() : undefined;
      items.push({ title: parsed.title, url, sourceCompanyName, publishedAt });
    } catch {
      // 取得できなかった個別アイテムはスキップ(軽量処理のため厳密なエラー処理はしない)
    }
  }
  return items;
}

// Apple公式App Store top-free/paid API(rss.marketingtools.apple.com)のレスポンス形式。
// Hacker Newsと同じfetchType="json"だが構造が全く異なるため専用パーサーが必要
function itemsFromAppStoreJson(raw: Buffer, sourceCompanyName: string): CandidateItem[] {
  const data = JSON.parse(raw.toString("utf-8"));
  const results = data?.feed?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r: { name?: string; url?: string }) => r?.name && r?.url)
    .map((r: { name: string; url: string }) => ({
      title: r.name,
      url: r.url,
      sourceCompanyName,
    }));
}

// テーマHソースの直近7日分の変化から、重複を除いた生アイテム一覧を集める。
// キーワードの絞り込み・優先順位づけは一切行わない(それは選定評議会の仕事)
export async function collectRecentItems(): Promise<CandidateItem[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const changes = await prisma.change.findMany({
    where: {
      detectedAt: { gte: since },
      source: { insuranceType: "theme_h" },
    },
    include: { source: true, newSnapshot: true },
  });

  const itemsByUrl = new Map<string, CandidateItem>();

  for (const change of changes) {
    const rawPath = change.newSnapshot.rawPath;
    if (!rawPath) continue;

    let raw: Buffer;
    try {
      raw = await readRawGz(rawPath);
    } catch {
      continue;
    }

    let items: CandidateItem[] = [];
    if (change.source.fetchType === "rss") {
      try {
        items = await itemsFromRss(raw, change.source.companyName);
      } catch {
        continue;
      }
    } else if (change.source.fetchType === "json") {
      const host = new URL(change.source.url).hostname;
      try {
        if (host === "hacker-news.firebaseio.com") {
          items = await itemsFromHnIdList(raw, change.source.companyName);
        } else if (host === "rss.marketingtools.apple.com") {
          items = itemsFromAppStoreJson(raw, change.source.companyName);
        } else {
          // 未対応のjson形式(候補抽出パーサー未実装)。1件のせいで全体を落とさずスキップする
          continue;
        }
      } catch {
        continue;
      }
    }

    for (const item of items) {
      itemsByUrl.set(item.url, item);
    }
  }

  const deduped = [...itemsByUrl.values()];
  return deduped.length > MAX_ITEMS ? deduped.slice(0, MAX_ITEMS) : deduped;
}
