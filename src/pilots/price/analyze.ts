import Anthropic from "@anthropic-ai/sdk";
import { appendExpense } from "../../lib/ledger";
import { parseJapaneseDate } from "../subsidy/classify";
import type { Direction, PriceNotice } from "./types";
import { decodeHtml, fetchWithTimeout, htmlToText, isPdf } from "./fetchUtil";

const MODEL = "claude-haiku-4-5";
const INPUT_PER_M_USD = 1;
const OUTPUT_PER_M_USD = 5;
// 初回は各社の過去の告知がまとめて見つかるため、1回の実行あたりの処理件数に上限を設け費用を平準化する
const MAX_PER_RUN = 40;
const MAX_ERRORS = 3;
const MAX_TEXT_CHARS = 20_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export const CATEGORIES: { name: string; slug: string }[] = [
  ["調味料", "seasoning"], ["乳製品", "dairy"], ["菓子", "confectionery"], ["飲料", "beverage"], ["コーヒー・茶", "coffee-tea"],
  ["食用油", "oil"], ["ハム・ソーセージ・加工肉", "processed-meat"], ["即席めん・麺類", "noodles"], ["小麦粉・パン・パスタ", "flour-bread"],
  ["冷凍食品", "frozen"], ["水産加工品", "seafood"], ["ふりかけ・惣菜の素", "furikake"], ["日用品", "household"], ["業務用", "foodservice"],
  ["その他", "other"],
].map(([name, slug]) => ({ name, slug }));

const SYSTEM_PROMPT = `あなたは日本の食品・日用品メーカーのニュースリリースから、価格改定の事実だけを抜き出す担当者です。
与えられたリリース本文を読み、次をJSONで返してください。本文に書かれていないことは推測せずnullにすること。
- isPriceRevision: 商品の価格改定(値上げ・値下げ)または内容量変更の告知ならtrue。それ以外(新商品・キャンペーン・決算等)はfalse
- direction: 値上げのみ"increase"、値下げのみ"decrease"、両方"mixed"、価格据え置きで内容量のみ変更"size_only"、該当しない"other"
- title: 30字以内の中立的な見出しを自分の言葉で書く(例:「家庭用マヨネーズ類を約5〜10%値上げ」)。社名は含めない
- summary: 対象・時期・幅を1〜2文で自分の言葉で要約する。本文の文章をそのまま写さない
- announcedDate: 発表日。本文の表記のまま年月日部分を抜き出す(例:"2026年8月18日"、"令和8年8月18日")
- effectiveDate: 改定の実施日(複数あれば最も早いもの)。本文の表記のまま年月日部分を抜き出す。「10月1日納品分より」等は"10月1日"
- rateText: 改定率の本文の表記(例:"約3〜20%")。無ければnull
- rateMinPct / rateMaxPct: 改定率の最小・最大を数値(%)で。1つだけなら両方同じ値。無ければnull
- sizeChange: 内容量・規格の変更を含むならtrue
- brands: 対象の主なブランド名・商品名を最大15件(本文に出てくる表記のまま)
- categories: 対象品目の分類を次から選ぶ: ${CATEGORIES.map((c) => c.name).join(" / ")}`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    isPriceRevision: { type: "boolean" },
    direction: { type: "string", enum: ["increase", "decrease", "mixed", "size_only", "other"] },
    title: { type: "string" },
    summary: { type: "string" },
    announcedDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    effectiveDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    rateText: { anyOf: [{ type: "string" }, { type: "null" }] },
    rateMinPct: { anyOf: [{ type: "number" }, { type: "null" }] },
    rateMaxPct: { anyOf: [{ type: "number" }, { type: "null" }] },
    sizeChange: { type: "boolean" },
    brands: { type: "array", items: { type: "string" } },
    categories: { type: "array", items: { type: "string", enum: CATEGORIES.map((c) => c.name) } },
  },
  required: ["isPriceRevision", "direction", "title", "summary", "announcedDate", "effectiveDate", "rateText", "rateMinPct", "rateMaxPct", "sizeChange", "brands", "categories"],
  additionalProperties: false,
} as const;

interface Extraction {
  isPriceRevision: boolean;
  direction: Direction;
  title: string;
  summary: string;
  announcedDate: string | null;
  effectiveDate: string | null;
  rateText: string | null;
  rateMinPct: number | null;
  rateMaxPct: number | null;
  sizeChange: boolean;
  brands: string[];
  categories: string[];
}

async function buildContent(notice: PriceNotice): Promise<Anthropic.ContentBlockParam[]> {
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

function applyExtraction(notice: PriceNotice, e: Extraction): void {
  // 本文に発表日が無い会社(明治等)は、一覧の見出しの日付("2026/07/28"等)で補う
  const listDate = notice.linkText.match(/(20\d\d)[./年]\s*(\d{1,2})[./月]\s*(\d{1,2})/);
  const announcedAt =
    parseJapaneseDate(e.announcedDate, notice.discoveredAt) ??
    (listDate ? parseJapaneseDate(`${listDate[1]}年${listDate[2]}月${listDate[3]}日`, null) : null);
  notice.isPriceRevision = e.isPriceRevision;
  notice.direction = e.direction;
  notice.title = e.title.trim() || null;
  notice.summary = e.summary.trim() || null;
  notice.announcedAt = announcedAt;
  // 年の無い実施日(「10月1日納品分より」等)は発表日を基準に年を決める
  notice.effectiveAt = parseJapaneseDate(e.effectiveDate, announcedAt ?? notice.discoveredAt);
  notice.rateText = e.rateText;
  notice.rateMinPct = e.rateMinPct;
  notice.rateMaxPct = e.rateMaxPct;
  notice.sizeChange = e.sizeChange;
  notice.brands = e.brands.map((b) => b.trim()).filter(Boolean).slice(0, 15);
  notice.categories = e.categories;
}

export async function analyzePending(store: Map<string, PriceNotice>): Promise<{ analyzed: number; costUsd: number; remaining: number }> {
  const queue = [...store.values()]
    .filter((n) => n.status === "pending" || (n.status === "error" && n.errorCount < MAX_ERRORS))
    .sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt) || a.listOrder - b.listOrder);
  const batch = queue.slice(0, MAX_PER_RUN);
  if (batch.length === 0) return { analyzed: 0, costUsd: 0, remaining: 0 };

  const client = new Anthropic();
  let inputTokens = 0;
  let outputTokens = 0;
  let analyzed = 0;

  for (const notice of batch) {
    try {
      const content = await buildContent(notice);
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      });
      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      if (response.stop_reason !== "end_turn") throw new Error(`stop_reason=${response.stop_reason}`);
      const text = response.content.find((b) => b.type === "text");
      applyExtraction(notice, JSON.parse(text && text.type === "text" ? text.text : "{}") as Extraction);
      notice.status = "analyzed";
      notice.analyzedAt = new Date().toISOString();
      notice.lastError = null;
      analyzed++;
    } catch (err) {
      notice.status = "error";
      notice.errorCount++;
      notice.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[analyze] ${notice.company} ${notice.url} failed(${notice.errorCount}): ${notice.lastError}`);
    }
  }

  const costUsd = (inputTokens * INPUT_PER_M_USD + outputTokens * OUTPUT_PER_M_USD) / 1_000_000;
  if (costUsd > 0) {
    await appendExpense({
      category: "api",
      service: "pilot-price-haiku",
      amountUsd: costUsd,
      amountJpy: null,
      description: `値上げ情報パイロット: リリース${analyzed}件を抽出(in=${inputTokens} out=${outputTokens})`,
      occurredAt: new Date().toISOString(),
    });
  }
  const remaining = queue.length - batch.length;
  console.log(`[analyze] batch=${batch.length} analyzed=${analyzed} remaining=${remaining} costUsd=${costUsd.toFixed(4)}`);
  return { analyzed, costUsd, remaining };
}
