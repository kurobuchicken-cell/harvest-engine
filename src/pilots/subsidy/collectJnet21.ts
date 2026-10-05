import Parser from "rss-parser";
import { politeFetch } from "../../lib/politeness";
import type { SubsidyItem } from "./types";
import { normalizeRegions } from "./taxonomy";

const FEED_URL = "https://j-net21.smrj.go.jp/snavi/support/support.xml";

type CoverageNode = { "rdf:label"?: string[] };
type FeedItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
  coverages?: CoverageNode[];
  subject?: string;
};

const parser: Parser<object, FeedItem> = new Parser({
  customFields: { item: [["dc:coverage", "coverages", { keepArray: true }], ["dc:subject", "subject"]] },
});

// dc:subjectは「補助金・助成金・融資 - 融資・貸付」の形式。前半の総称にも「融資」が含まれるため後半で判定する
export function kindFromSubject(subject: string | undefined): SubsidyItem["kind"] {
  const detail = subject?.split(" - ")[1] ?? "";
  return detail.includes("融資") ? "loan" : "grant";
}

// RSSは最新数十件しか載らないため、取得のたびにストアへ蓄積する。分類はclassify.tsで後から行う
export async function collectJnet21(store: Map<string, SubsidyItem>): Promise<number> {
  const res = await politeFetch(FEED_URL);
  if (res.status !== 200 || !res.body) {
    throw new Error(`jnet21 fetch failed: status=${res.status} error=${res.error ?? ""}`);
  }
  const feed = await parser.parseString(res.body.toString("utf-8"));
  const now = new Date().toISOString();
  let added = 0;
  for (const entry of feed.items) {
    const articleId = entry.link?.match(/articles\/(\d+)/)?.[1];
    if (!articleId || !entry.title) continue;
    const id = `jnet21:${articleId}`;
    const prev = store.get(id);
    if (prev) {
      prev.lastSeenAt = now;
      continue;
    }
    const labels = (entry.coverages ?? []).flatMap((c) => c["rdf:label"] ?? []);
    store.set(id, {
      id,
      source: "jnet21",
      title: entry.title,
      url: entry.link!,
      institution: null,
      kind: kindFromSubject(entry.subject),
      regions: normalizeRegions(labels),
      industries: [],
      purposes: [],
      targetEmployees: null,
      maxAmountYen: null,
      acceptanceStart: null,
      acceptanceEnd: null,
      publishedAt: entry.isoDate ?? null,
      classifiedBy: "pending",
      firstSeenAt: now,
      lastSeenAt: now,
      rawText: `${entry.subject ?? ""}\n${entry.title}\n${entry.contentSnippet ?? ""}`,
    });
    added++;
  }
  console.log(`[jnet21] feedItems=${feed.items.length} added=${added}`);
  return feed.items.length;
}
