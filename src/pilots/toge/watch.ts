import { createHash } from "node:crypto";
import { decodeHtml, fetchWithTimeout, htmlToText, isPdf } from "../../factory/fetch";
import { sourceFailure, type SourceReport } from "../../factory/genre";
import { PUBLISHERS, SOURCES, type TogeSource } from "./sources";
import type { TogePage, WatchedDoc } from "./types";

const DOC_KEYWORDS = /冬期|冬季|閉鎖|通行止|通行規制|解除|開通|toki|touki|tooki|heisa|kisei|kaijo|tuukou|tsuukou|winter/i;
const TITLE_KEYWORDS = /冬期|冬季|閉鎖|通行止/;
const MAX_PDFS = 5;
const MAX_IMAGES = 3;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

// 道路情報システム(system)は読み込み式の画面が多く本文が取れないため、当面は本文・PDFで発表しているページだけを見張る
export const ACTIVE_SOURCES: TogeSource[] = SOURCES.filter((s) => {
  const publisher = PUBLISHERS.find((p) => p.id === s.publisherId);
  return s.url && s.robotsCheckedOn && !s.skip && s.format !== "system" && publisher?.checkedOn;
});

export interface PageContent {
  text: string;
  docs: (WatchedDoc & { body: Buffer })[];
}

// 同じ実行の中でAIに渡すとき再取得しないよう、見張りで読んだ中身を持っておく
export const pageContents = new Map<string, PageContent>();

const sha1 = (data: string | Buffer) => createHash("sha1").update(data).digest("hex");

// 変化の判定だけに使う。あきたのみち情報の「ｱｸｾｽ数 今日: 2115」のように、カウンタの数字が改行で別の行に分かれて毎回変わるため、
// 数字だけの行とカウンタの見出しを外す(AIに渡す本文からは外さない。数字だけの表のセルを失わないため)
export function textForHash(text: string): string {
  return text
    .normalize("NFKC")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !/^[\d,.]*$/.test(line) && !/アクセス数|^(今日|昨日|総計|平均)\s*:/.test(line))
    .join("\n");
}

// 閲覧数やアクセスカウンタのように、発表の中身と関係なく毎回変わる行はハッシュから外す
export function normalizeText(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/閲覧数|アクセス数|カウンタ|現在時刻/.test(line))
    .join("\n")
    .trim();
}

function anchors(html: string, baseUrl: string): { url: string; label: string; href: string }[] {
  const list: { url: string; label: string; href: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(m[1].replace(/&amp;/g, "&"), baseUrl).href;
      if (/^https?:/.test(url)) list.push({ url, label: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), href: m[1] });
    } catch {
      // URLとして解釈できないリンクは無視する
    }
  }
  return list;
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// ファイル名に年度が入り毎年変わるため、URLを固定せず掲載ページのリンクを毎回辿る。
// 題名が冬期閉鎖のページ(奈良の「報道発表(PDF)」等)はリンク文言にキーワードが無くてもPDFを拾う
export function findDocLinks(html: string, baseUrl: string, readImages: boolean): { url: string; kind: "pdf" | "image" }[] {
  const docs: { url: string; kind: "pdf" | "image" }[] = [];
  const seen = new Set<string>();
  const titleMatches = TITLE_KEYWORDS.test(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  for (const a of anchors(html, baseUrl)) {
    if (docs.length >= MAX_PDFS) break;
    if (!/\.pdf(\?|$)/i.test(a.url) || seen.has(a.url)) continue;
    if (!titleMatches && !DOC_KEYWORDS.test(a.label) && !DOC_KEYWORDS.test(safeDecode(a.href))) continue;
    seen.add(a.url);
    docs.push({ url: a.url, kind: "pdf" });
  }
  if (readImages) {
    const body = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
    let images = 0;
    for (const m of body.matchAll(/<img\b[^>]*src=["']([^"']+\.(?:png|jpe?g))["']/gi)) {
      if (images >= MAX_IMAGES) break;
      if (/logo|icon|banner|common|shared|btn|button/i.test(m[1])) continue;
      const url = new URL(m[1], baseUrl).href;
      if (seen.has(url)) continue;
      seen.add(url);
      docs.push({ url, kind: "image" });
      images++;
    }
  }
  return docs;
}

export function findFollowLinks(html: string, baseUrl: string, follow: { label: string; max: number }): string[] {
  const re = new RegExp(follow.label);
  const urls: string[] = [];
  for (const a of anchors(html, baseUrl)) {
    if (urls.length >= follow.max) break;
    if (/\.pdf(\?|$)/i.test(a.url) || !re.test(a.label) || urls.includes(a.url)) continue;
    urls.push(a.url);
  }
  return urls;
}

async function fetchBody(url: string): Promise<Buffer> {
  const res = await fetchWithTimeout(url, 60_000);
  if (res.status !== 200 || !res.body) throw new Error(`fetch status=${res.status} ${res.error ?? ""} ${url}`);
  if (res.body.length > MAX_DOC_BYTES) throw new Error(`too large: ${res.body.length} ${url}`);
  return res.body;
}

async function readHtml(url: string, body: Buffer, readImages: boolean, content: PageContent): Promise<string> {
  const html = decodeHtml(body);
  content.text += `${content.text ? `\n\n---子ページ ${url}---\n` : ""}${normalizeText(htmlToText(html))}`;
  for (const link of findDocLinks(html, url, readImages)) {
    if (content.docs.some((d) => d.url === link.url)) continue;
    let doc: Buffer;
    try {
      doc = await fetchBody(link.url);
    } catch (err) {
      // 地図など大きな添付が1つあるだけでページ全体を失敗にしない(区間の表は別の添付・本文にある)
      if (!(err instanceof Error && err.message.startsWith("too large"))) throw err;
      console.warn(`[toge] skip ${err.message}`);
      continue;
    }
    if (link.kind === "pdf" && !isPdf(doc)) continue;
    content.docs.push({ ...link, hash: sha1(doc), body: doc });
  }
  return html;
}

export async function readSource(source: TogeSource): Promise<PageContent> {
  const content: PageContent = { text: "", docs: [] };
  const body = await fetchBody(source.url!);
  if (isPdf(body)) {
    content.docs.push({ url: source.url!, kind: "pdf", hash: sha1(body), body });
  } else {
    const html = await readHtml(source.url!, body, source.readImages ?? false, content);
    for (const url of source.follow ? findFollowLinks(html, source.url!, source.follow) : []) {
      await readHtml(url, await fetchBody(url), source.readImages ?? false, content);
    }
  }
  pageContents.set(source.id, content);
  return content;
}

function emptyPage(source: TogeSource): TogePage {
  return {
    id: source.id, publisherId: source.publisherId, url: source.url!, textHash: null, docs: [], contentHash: null, analyzedHash: null,
    status: "pending", errorCount: 0, lastError: null, checkedAt: null, changedAt: null, analyzedAt: null, announcedAt: null, rows: [],
  };
}

async function watchSource(source: TogeSource, store: Map<string, TogePage>, now: string): Promise<SourceReport> {
  const page = store.get(source.id) ?? emptyPage(source);
  page.url = source.url!;
  const { text, docs } = await readSource(source);
  const textHash = sha1(textForHash(text));
  const contentHash = sha1([textHash, ...docs.map((d) => `${d.url}#${d.hash}`).sort()].join("\n"));
  page.textHash = textHash;
  page.docs = docs.map(({ url, kind, hash }) => ({ url, kind, hash }));
  page.checkedAt = now;
  if (page.contentHash !== contentHash) {
    page.contentHash = contentHash;
    page.changedAt = now;
    page.status = "pending";
    page.errorCount = 0;
    console.log(`[toge] ${source.id} changed (text=${text.length} docs=${docs.length})`);
  }
  store.set(source.id, page);
  // 急減の検知用。ページが空になる・PDFが消えると下がる
  return { sourceId: source.id, seen: Math.round(text.length / 100) + docs.length * 10, ok: true };
}

export async function watchAll(store: Map<string, TogePage>): Promise<SourceReport[]> {
  const now = new Date().toISOString();
  // 同一ホストの直列化と間隔はpoliteFetch側が担保する
  return Promise.all(ACTIVE_SOURCES.map((s) => watchSource(s, store, now).catch((err) => sourceFailure(s.id, err))));
}
