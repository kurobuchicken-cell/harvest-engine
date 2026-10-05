import { parseJapaneseDate } from "../subsidy/classify";
import type { Direction, PriceNotice } from "./types";

export const CATEGORIES: { name: string; slug: string }[] = [
  ["調味料", "seasoning"], ["乳製品", "dairy"], ["菓子", "confectionery"], ["飲料", "beverage"], ["コーヒー・茶", "coffee-tea"],
  ["食用油", "oil"], ["ハム・ソーセージ・加工肉", "processed-meat"], ["即席めん・麺類", "noodles"], ["小麦粉・パン・パスタ", "flour-bread"],
  ["冷凍食品", "frozen"], ["水産加工品", "seafood"], ["ふりかけ・惣菜の素", "furikake"], ["日用品", "household"], ["業務用", "foodservice"],
  ["その他", "other"],
].map(([name, slug]) => ({ name, slug }));

export const SYSTEM_PROMPT = `あなたは日本の食品・日用品メーカーのニュースリリースから、価格改定の事実だけを抜き出す担当者です。
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

export const OUTPUT_SCHEMA = {
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

export interface Extraction {
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

export function applyExtraction(notice: PriceNotice, e: Extraction): void {
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
