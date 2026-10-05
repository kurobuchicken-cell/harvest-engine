import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { AiSession, responseText, type AiBudget } from "../ai";
import { decodeHtml, fetchWithTimeout, htmlToText, isPdf } from "../fetch";
import { sourceFailure, type SourceReport } from "../genre";

// 値上げ型: 各社のお知らせ一覧から、リンク文言がキーワードに当たる告知を拾い、本文(または添付PDF)をAIで構造化する。
// 社ごとの専用パーサーを持たないので、ジャンルの追加は「一覧URL+キーワード+AIで取り出す項目」の設定で済む

export interface AnnouncementSource {
  id: string; // ページのslugにも使う
  company: string;
  listUrl: string; // お知らせ一覧(SSRでリンクが取れることを確認済みのもの)
}

export interface AnnouncementBase {
  id: string; // URLのハッシュ
  sourceId: string;
  company: string;
  url: string;
  linkText: string; // 一覧ページのリンク文言(抽出対象の判定に使った文字列。ページには出さない)
  listOrder: number; // 一覧での掲載順(小さいほど新しい)。1回のAI処理件数を絞るときの優先度に使う
  status: "pending" | "analyzed" | "error";
  errorCount: number;
  lastError: string | null;
  discoveredAt: string;
  analyzedAt: string | null;
}

export interface AnnouncementConfig<T extends AnnouncementBase, E> {
  sources: AnnouncementSource[];
  linkKeywords: RegExp;
  emptyFields(): Omit<T, keyof AnnouncementBase>;
  ai: {
    service: string;
    model: string;
    system: string;
    schema: Record<string, unknown>;
    // 初回は各社の過去の告知がまとめて見つかるため、1回の実行あたりの処理件数に上限を設け費用を平準化する
    maxPerRun: number;
  };
  apply(item: T, extraction: E): void;
  costDescription(analyzed: number): string;
}

const MAX_ERRORS = 3;
const MAX_TEXT_CHARS = 20_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function extractNoticeLinks(html: string, baseUrl: string, keywords: RegExp): { links: { url: string; text: string }[]; totalLinks: number } {
  const seen = new Set<string>();
  const links: { url: string; text: string }[] = [];
  let totalLinks = 0;
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    totalLinks++;
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!keywords.test(text)) continue;
    let url: string;
    try {
      url = new URL(m[1].replace(/&amp;/g, "&"), baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/.test(url) || seen.has(url)) continue;
    seen.add(url);
    links.push({ url, text: text.slice(0, 200) });
  }
  return { links, totalLinks };
}

export const noticeId = (url: string) => createHash("sha1").update(url).digest("hex").slice(0, 16);

// 急減の検知には、キーワードで絞る前の一覧上のリンク総数を使う(告知が無い週でも0にならないため)
async function collectSource<T extends AnnouncementBase, E>(
  config: AnnouncementConfig<T, E>,
  source: AnnouncementSource,
  store: Map<string, T>,
  now: string,
): Promise<SourceReport> {
  const res = await fetchWithTimeout(source.listUrl);
  if (res.status !== 200 || !res.body) throw new Error(`list status=${res.status} ${res.error ?? ""}`);
  const { links, totalLinks } = extractNoticeLinks(decodeHtml(res.body), source.listUrl, config.linkKeywords);
  let added = 0;
  links.forEach((link, index) => {
    const id = noticeId(link.url);
    if (store.has(id)) return;
    store.set(id, {
      id, sourceId: source.id, company: source.company, url: link.url, linkText: link.text, listOrder: index,
      status: "pending", errorCount: 0, lastError: null,
      ...config.emptyFields(),
      discoveredAt: now, analyzedAt: null,
    } as T);
    added++;
  });
  console.log(`[collect] ${source.company} links=${totalLinks} matched=${links.length} new=${added}`);
  return { sourceId: source.id, seen: totalLinks, ok: true };
}

export async function collectAnnouncements<T extends AnnouncementBase, E>(config: AnnouncementConfig<T, E>, store: Map<string, T>): Promise<SourceReport[]> {
  const now = new Date().toISOString();
  // 各社のホストは全て異なるため並列で取得してよい(同一ホストの直列化はpoliteFetch側が担保)
  return Promise.all(config.sources.map((s) => collectSource(config, s, store, now).catch((err) => sourceFailure(s.id, err))));
}

async function buildContent(notice: AnnouncementBase): Promise<Anthropic.ContentBlockParam[]> {
  const res = await fetchWithTimeout(notice.url, 60_000);
  if (res.status !== 200 || !res.body) throw new Error(`fetch status=${res.status} ${res.error ?? ""}`);
  const header = `会社: ${notice.company}\nURL: ${notice.url}\n一覧での見出し: ${notice.linkText}`;
  if (isPdf(res.body)) {
    if (res.body.length > MAX_PDF_BYTES) throw new Error(`pdf too large: ${res.body.length}`);
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: res.body.toString("base64") } },
      { type: "text", text: header },
    ];
  }
  const html = decodeHtml(res.body);
  const text = htmlToText(html);
  const blocks: Anthropic.ContentBlockParam[] = [];
  // 詳細を添付PDFにだけ載せる会社(ヤクルト・ネスレ日本等)があるため、本文が短いかPDFへの言及があれば添付PDFも読ませる
  if (text.length < 1500 || /PDF/i.test(text)) {
    // カゴメ等はページ自体がJSのlocation.hrefでPDFへ転送するだけなので、転送先を優先する
    const pdfUrl = (text.length < 200 ? findRedirect(html, notice.url) : null) ?? findAttachedPdf(html, notice.url);
    if (pdfUrl) {
      const pdf = await fetchWithTimeout(pdfUrl, 60_000);
      if (pdf.status === 200 && pdf.body && isPdf(pdf.body) && pdf.body.length <= MAX_PDF_BYTES) {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.body.toString("base64") } });
      }
    }
  }
  if (blocks.length === 0 && text.length < 50) throw new Error(`text too short (${text.length} chars)`);
  blocks.push({ type: "text", text: `${header}\n\n---本文---\n${text.slice(0, MAX_TEXT_CHARS)}` });
  return blocks;
}

export function findRedirect(html: string, baseUrl: string): string | null {
  const target =
    html.match(/location\.(?:href\s*=|replace\()\s*["']([^"']+)["']/)?.[1] ??
    html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)/i)?.[1];
  if (!target) return null;
  try {
    return new URL(target, baseUrl).href;
  } catch {
    return null;
  }
}

// ページ内のPDFリンクのうち、告知の添付と思われるもの(リンク文言かURLにPDF/こちら/価格/リリース等を含む)を1件選ぶ
export function findAttachedPdf(html: string, baseUrl: string): string | null {
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (!/\.pdf(\?|$)/i.test(href) && !/file\.jsp|download|attach/i.test(href)) continue;
    const label = m[2].replace(/<[^>]+>/g, "");
    if (!/PDF|こちら|価格|改定|リリース|お知らせ/i.test(label) && !/news|release|press/i.test(href)) continue;
    try {
      return new URL(href, baseUrl).href;
    } catch {
      continue;
    }
  }
  return null;
}

export async function analyzeAnnouncements<T extends AnnouncementBase, E>(
  config: AnnouncementConfig<T, E>,
  store: Map<string, T>,
  budget: AiBudget,
): Promise<void> {
  const queue = [...store.values()]
    .filter((n) => n.status === "pending" || (n.status === "error" && n.errorCount < MAX_ERRORS))
    .sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt) || a.listOrder - b.listOrder);
  const batch = queue.slice(0, config.ai.maxPerRun);
  if (batch.length === 0) return;

  const ai = new AiSession(budget, config.ai.service, config.ai.model);
  let analyzed = 0;
  let attempted = 0;

  for (const notice of batch) {
    try {
      const content = await buildContent(notice);
      const response = await ai.create({
        max_tokens: 4000,
        system: config.ai.system,
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: config.ai.schema } },
      });
      // 予算切れ: 残りはpendingのまま次回に回す
      if (!response) break;
      attempted++;
      if (response.stop_reason !== "end_turn") throw new Error(`stop_reason=${response.stop_reason}`);
      config.apply(notice, JSON.parse(responseText(response)) as E);
      notice.status = "analyzed";
      notice.analyzedAt = new Date().toISOString();
      notice.lastError = null;
      analyzed++;
    } catch (err) {
      attempted++;
      notice.status = "error";
      notice.errorCount++;
      notice.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[analyze] ${notice.company} ${notice.url} failed(${notice.errorCount}): ${notice.lastError}`);
    }
  }

  await ai.record(config.costDescription(analyzed));
  const remaining = queue.length - attempted;
  console.log(`[analyze] batch=${batch.length} analyzed=${analyzed} remaining=${remaining} costUsd=${ai.costUsd.toFixed(4)}`);
}
