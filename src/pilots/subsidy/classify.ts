import { AiSession, responseText, type AiBudget } from "../../factory/ai";
import type { SubsidyItem } from "./types";
import { INDUSTRIES, PURPOSES } from "./taxonomy";

const MODEL = "claude-haiku-4-5";
const BATCH_SIZE = 20;

const SYSTEM_PROMPT = `あなたは日本の補助金・助成金・融資の告知文を分類する担当者です。
入力の各案件について、次を判定してJSONで返してください。
- programName: 制度・事業の正式名称のみ(「令和8年度」等の年度表記は残す。「募集を開始します」等の告知文言や自治体名の【】は除く)
- industries: 対象業種を次の語彙から選ぶ。業種を限定していない場合は空配列
- purposes: 利用目的を次の語彙から1〜3個選ぶ
- acceptanceEnd: 申請受付の締切日が本文にあれば、本文の表記のまま年月日部分だけを抜き出す(例:"令和9年1月15日"、"2026年11月18日"、"11月18日")。換算はしない。無ければnull

業種の語彙: ${INDUSTRIES.map((i) => i.name).join(" / ")}
目的の語彙: ${PURPOSES.map((p) => p.name).join(" / ")}`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          programName: { type: "string" },
          industries: { type: "array", items: { type: "string", enum: INDUSTRIES.map((i) => i.name) } },
          purposes: { type: "array", items: { type: "string", enum: PURPOSES.map((p) => p.name) } },
          acceptanceEnd: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["index", "programName", "industries", "purposes", "acceptanceEnd"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

interface Classification {
  index: number;
  programName: string;
  industries: string[];
  purposes: string[];
  acceptanceEnd: string | null;
}

// 和暦の換算はAIが誤ることがあったため(令和9年を2026年と出力)、AIには表記のまま返させてコードで換算する
export function parseJapaneseDate(text: string | null, publishedAt: string | null): string | null {
  if (!text) return null;
  const digits = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const m = digits.match(/(?:(令和|平成)?\s*(\d+|元)\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return null;
  const [, era, yearText, monthText, dayText] = m;
  const month = Number(monthText);
  const day = Number(dayText);
  let year: number;
  if (yearText) {
    const n = yearText === "元" ? 1 : Number(yearText);
    year = era === "令和" ? 2018 + n : era === "平成" ? 1988 + n : n;
  } else {
    // 年の無い日付は掲載日以降で最も近い日付とみなす
    const base = publishedAt ? new Date(publishedAt) : new Date();
    const baseYear = Number(base.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(0, 4));
    const baseMonth = Number(base.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(5, 7));
    year = month < baseMonth ? baseYear + 1 : baseYear;
  }
  // 2月30日のような存在しない日付はDateが翌月に繰り越すため、組み立て直して一致を確認する
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59+09:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// 未分類(pending)のJ-Net21案件だけをAIに渡す。分類済みは再分類しない(費用を毎回発生させないため)
export async function classifyPending(store: Map<string, SubsidyItem>, budget: AiBudget): Promise<void> {
  const pending = [...store.values()].filter((item) => item.classifiedBy === "pending" && item.rawText);
  if (pending.length === 0) return;

  const ai = new AiSession(budget, "pilot-subsidy-haiku", MODEL);
  let classified = 0;

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const userContent = batch.map((item, i) => `### index=${i}\n${item.rawText}`).join("\n\n");
    try {
      const response = await ai.create({
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      });
      // 予算切れ: 残りは未分類のまま次回に回す
      if (!response) break;
      if (response.stop_reason !== "end_turn") {
        console.error(`[classify] batch@${start} stop_reason=${response.stop_reason}、スキップ`);
        continue;
      }
      const parsed = JSON.parse(responseText(response)) as { results?: Classification[] };
      for (const result of parsed.results ?? []) {
        const item = batch[result.index];
        if (!item) continue;
        item.title = result.programName || item.title;
        item.industries = result.industries;
        item.purposes = result.purposes;
        item.acceptanceEnd = parseJapaneseDate(result.acceptanceEnd, item.publishedAt);
        item.classifiedBy = "ai";
        classified++;
      }
    } catch (err) {
      console.error(`[classify] batch@${start} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  await ai.record(`補助金パイロット: J-Net21案件${classified}件をAI分類`);
  console.log(`[classify] pending=${pending.length} classified=${classified} costUsd=${ai.costUsd.toFixed(4)}`);
}
