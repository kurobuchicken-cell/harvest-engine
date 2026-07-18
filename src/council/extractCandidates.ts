import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";
import { prisma } from "../lib/prisma";
import { politeFetch } from "../lib/politeness";
import type { Candidate, CandidateItem } from "./types";

const WINDOW_DAYS = 7;
const MAX_CANDIDATES = 10;
const rssParser = new Parser();

const CJK_REGEX = /[぀-ヿ㐀-鿿]/;

const EN_STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are",
  "was", "were", "with", "this", "that", "it", "as", "at", "by", "from",
  "be", "how", "what", "why", "your", "you", "we", "i", "not", "but", "new",
  "show", "ask", "hn", "will", "can", "our", "their", "has", "have", "into",
]);

// 形態素解析器を使わない軽量n-gram法のため、意味の薄い頻出2文字組を最小限だけ除外する
const JA_STOP_BIGRAMS = new Set([
  "した", "して", "です", "ます", "こと", "もの", "ため", "など", "これ",
  "それ", "この", "その", "ある", "いる", "なる", "れる", "られ", "いう",
  "する", "から", "にて", "また", "とは",
]);

function isCjk(text: string): boolean {
  return CJK_REGEX.test(text);
}

function extractTerms(title: string): string[] {
  if (isCjk(title)) {
    const cleaned = title.replace(/[\s\p{P}\p{S}]/gu, "");
    const bigrams: string[] = [];
    for (let i = 0; i < cleaned.length - 1; i++) {
      const bg = cleaned.slice(i, i + 2);
      if (!JA_STOP_BIGRAMS.has(bg) && !/^[0-9]+$/.test(bg)) bigrams.push(bg);
    }
    return bigrams;
  }
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !EN_STOPWORDS.has(w));
}

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
    .map((item) => ({ title: item.title!, url: item.link!, sourceCompanyName }));
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
      items.push({ title: parsed.title, url, sourceCompanyName });
    } catch {
      // 取得できなかった個別アイテムはスキップ(軽量処理のため厳密なエラー処理はしない)
    }
  }
  return items;
}

async function collectRecentItems(): Promise<CandidateItem[]> {
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
      items = await itemsFromHnIdList(raw, change.source.companyName);
    }

    for (const item of items) {
      itemsByUrl.set(item.url, item);
    }
  }

  return [...itemsByUrl.values()];
}

export async function extractCandidates(): Promise<Candidate[]> {
  const items = await collectRecentItems();

  const termIndex = new Map<string, Map<string, CandidateItem>>();
  for (const item of items) {
    const terms = new Set(extractTerms(item.title));
    for (const term of terms) {
      if (!termIndex.has(term)) termIndex.set(term, new Map());
      termIndex.get(term)!.set(item.url, item);
    }
  }

  const ranked = [...termIndex.entries()]
    .map(([term, matchedItems]) => ({ term, items: [...matchedItems.values()] }))
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, MAX_CANDIDATES);

  return ranked.map(({ term, items: matchedItems }) => ({
    topic: term,
    score: matchedItems.length,
    sourceUrls: matchedItems.slice(0, 3).map((i) => i.url),
    excerpt: matchedItems.slice(0, 3).map((i) => i.title).join(" / "),
  }));
}
