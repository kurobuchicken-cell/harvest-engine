import type Anthropic from "@anthropic-ai/sdk";
import { AiSession, responseText, type AiBudget } from "../../factory/ai";
import { PUBLISHERS, SOURCES } from "./sources";
import type { TogePage, TogeRow } from "./types";
import { pageContents, readSource } from "./watch";

const MODEL = "claude-haiku-4-5";
const SERVICE = "pilot-toge-haiku";
const MAX_ERRORS = 3;
const MAX_TEXT_CHARS = 20_000;

export const SYSTEM_PROMPT = `あなたは日本の県・国の道路管理者が出す通行止めの発表から、区間ごとの事実だけを抜き出す担当者です。
与えられたページ本文・PDF・画像を読み、次をJSONで返してください。書かれていないことは推測せずnullにすること。
ページには冬期閉鎖と関係のない記事(雨量規制・入札・申請など)も混ざるが、通行止め・閉鎖の対象区間が載っていれば必ず拾う。
- announcedDate: 発表日・更新日(YYYY-MM-DD)。無ければnull
- rows: 通行止め・閉鎖の対象区間ごとに1行
  - route: 路線名(本文の表記のまま。例:"国道292号"、"主要地方道 中之条草津線")
  - section: 区間(起点〜終点の地名。本文の表記のまま)
  - passNames: 本文に出てくる峠・道路の通称(例:"渋峠"、"志賀草津道路")。無ければ空配列
  - reason: 通行止めの理由。"winter"(冬期閉鎖・冬期通行止め・冬期交通不能)/"disaster"(崩土・落石・災害復旧)/"construction"(工事)/
    "weather"(大雪・雨量規制など気象による一時的な規制)/"other"
  - reopenedExplicit: 「解除しました」「通行止めを解除」「開通しました」のように、解除済みであることが明記されていればtrue。予定だけならfalse
  - closeAt: 閉鎖開始の日時
  - reopenAt: 解除(開通)の日時。解除済みなら解除した日時、まだなら解除予定の日時
  - reopenCertainty: "confirmed"(解除日時が決定・解除済み)/"planned"(予定・見込み・例年など)/"undecided"(未定・記載なし)
  - vehicles: 通行できる車両の制限(マイカー規制、二輪通行不可、夜間通行止めなど)を短く。無ければnull
  - note: 時間帯の規制などの補足を自分の言葉で30字以内。本文をそのまま写さない。無ければnull
日時は "YYYY-MM-DD" または時刻があれば "YYYY-MM-DDTHH:mm" で返す。和暦は西暦に直す(令和8年=2026年)。年が書かれていない日付は、
発表日から最も自然な年を補う(冬期閉鎖は秋〜冬に始まり翌年の春〜初夏に解除される)。「4月下旬」のように日が決まっていないものはnullにし、noteに書く。`;

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    announcedDate: nullable("string"),
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          route: { type: "string" },
          section: { type: "string" },
          passNames: { type: "array", items: { type: "string" } },
          reason: { type: "string", enum: ["winter", "disaster", "construction", "weather", "other"] },
          reopenedExplicit: { type: "boolean" },
          closeAt: nullable("string"),
          reopenAt: nullable("string"),
          reopenCertainty: { type: "string", enum: ["confirmed", "planned", "undecided"] },
          vehicles: nullable("string"),
          note: nullable("string"),
        },
        required: ["route", "section", "passNames", "reason", "reopenedExplicit", "closeAt", "reopenAt", "reopenCertainty", "vehicles", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["announcedDate", "rows"],
  additionalProperties: false,
} as const;

interface Extraction {
  announcedDate: string | null;
  rows: TogeRow[];
}

export const NO_SECTION = "区間の記載なし";

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const validDate = (s: string | null) => (s && DATE_RE.test(s) && !Number.isNaN(Date.parse(s.slice(0, 10))) ? s : null);

// 峠の開通通知で扱うのは季節の冬期閉鎖だけ。災害・工事・気象による一時的な通行止めは落とす
export function cleanRows(rows: TogeRow[]): TogeRow[] {
  return rows
    .filter((r) => r.reason === "winter" && r.route.trim())
    // 山梨の峡東のように路線と期間だけの表もあるため、区間が無い行も落とさない
    .map((r) => ({ ...r, route: r.route.trim(), section: r.section.trim() || NO_SECTION, closeAt: validDate(r.closeAt), reopenAt: validDate(r.reopenAt) }));
}

function imageType(buf: Buffer): "image/png" | "image/jpeg" | null {
  if (buf.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (buf.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  return null;
}

async function buildContent(page: TogePage, now: Date): Promise<Anthropic.ContentBlockParam[]> {
  const source = SOURCES.find((s) => s.id === page.id)!;
  const publisher = PUBLISHERS.find((p) => p.id === page.publisherId);
  const { text, docs } = pageContents.get(page.id) ?? (await readSource(source));
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const doc of docs) {
    if (doc.kind === "pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.body.toString("base64") } });
    } else {
      const mediaType = imageType(doc.body);
      if (mediaType) blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: doc.body.toString("base64") } });
    }
  }
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const header = `発行元: ${publisher?.name ?? page.publisherId} ${source.office}\nURL: ${page.url}\n基準日: ${today}`;
  blocks.push({ type: "text", text: `${header}\n\n---本文---\n${text.slice(0, MAX_TEXT_CHARS)}` });
  return blocks;
}

export async function analyzePages(store: Map<string, TogePage>, active: Set<string>, budget: AiBudget): Promise<void> {
  const queue = [...store.values()].filter(
    (p) => active.has(p.id) && p.contentHash !== p.analyzedHash && (p.status === "pending" || (p.status === "error" && p.errorCount < MAX_ERRORS)),
  );
  if (queue.length === 0) return;
  const ai = new AiSession(budget, SERVICE, MODEL);
  let analyzed = 0;
  for (const page of queue) {
    try {
      const response = await ai.create({
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: await buildContent(page, new Date()) }],
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      });
      // 予算切れ: 残りはpendingのまま次回に回す
      if (!response) break;
      if (response.stop_reason !== "end_turn") throw new Error(`stop_reason=${response.stop_reason}`);
      const extraction = JSON.parse(responseText(response)) as Extraction;
      page.rows = cleanRows(extraction.rows);
      page.announcedAt = validDate(extraction.announcedDate);
      page.analyzedHash = page.contentHash;
      page.analyzedAt = new Date().toISOString();
      page.status = "analyzed";
      page.lastError = null;
      analyzed++;
      console.log(`[toge] ${page.id} analyzed rows=${page.rows.length}`);
    } catch (err) {
      page.status = "error";
      page.errorCount++;
      page.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[toge] ${page.id} analyze failed(${page.errorCount}): ${page.lastError}`);
    }
  }
  await ai.record(`峠の開通通知パイロット: 発表ページ${analyzed}件を構造化`);
  console.log(`[toge] analyzed=${analyzed}/${queue.length} costUsd=${ai.costUsd.toFixed(4)}`);
}
