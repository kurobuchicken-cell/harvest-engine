import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { MODEL } from "./pricing";
import type { RoundUsage } from "./types";

export const MAX_TOKENS = 16000;

let governanceCache: string | null = null;

async function loadGovernance(): Promise<string> {
  if (governanceCache) return governanceCache;
  governanceCache = await readFile(path.resolve(process.cwd(), "GOVERNANCE.md"), "utf-8");
  return governanceCache;
}

// 選定(どのテーマを評議会にかけるか)・判断(採択/却下/保留)のどちらの評議会も、
// 同じ人格・同じ役割構成・同じ制約で審議する。役割が異なるのはユーザープロンプト側のみ
export async function buildSystemPrompt(): Promise<string> {
  const governance = await loadGovernance();
  return `あなたはharvest-engineプロジェクトの自動評議会です。以下のGOVERNANCE.mdに定められた経営体制・意思決定権限に従い、新テーマ候補を審議してください。

--- GOVERNANCE.md ---
${governance}
--- GOVERNANCE.md ここまで ---

評議会は以下の6役で構成されます。それぞれの視点から発言してください。
1. 市場戦略家: 市場規模・買い手仮説・競合状況を評価する
2. リスク管理官: robots.txt/ToS/法務・レピュテーションリスクを評価する
3. ハーヴェスト理論の番人: 3層+出口Liteのポートフォリオ制・60日判定・投下上限とのフィット感を評価する
4. 地域リサーチャー: 対象テーマが日本市場/海外市場のどちらに向くか、実際にweb_searchで裏取りしながら評価する
5. 運用・財務担当: 収集コスト・API予算・巡回負荷の見込みを評価する
6. 監査役: 他5役の発言に対し、既存資産や直前の結論へのアンカリングがないかを検査する。監査役コメントは必須項目であり、省略してはならない

重要な制約: 裁定項目に「現有資産適合」のような既存プロジェクトを有利にする項目を入れてはならない。
選択肢生成の段階で既存資産・直前の結論に引っ張られていないかを、監査役が必ず検査すること。

推測ではなくweb_searchで検索した事実に基づいて発言してください。`;
}

// LLMが```json ... ```ブロックの末尾に余分な閉じ括弧等を出力する既知の失敗パターンに対応する。
// 素のJSON.parseが失敗した場合、末尾から1文字ずつ削って再パースを試みる(最大20文字)。
// 「有効なJSONの後に余分な非空白文字がある」系のエラーはこれで大半が復旧できる。
// 復旧してもなお失敗する場合はnullを返し、呼び出し側の安全側フォールバックに委ねる
export function extractJsonBlock<T>(text: string, validate: (parsed: unknown) => parsed is T): T | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;

  const raw = match[1];
  const MAX_TRIM = 20;
  for (let trim = 0; trim <= MAX_TRIM && trim < raw.length; trim++) {
    const candidate = trim === 0 ? raw : raw.slice(0, -trim);
    try {
      const parsed = JSON.parse(candidate);
      if (validate(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export function extractText(content: ContentBlockParam[] | Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

export function toRoundUsage(usage: Anthropic.Usage): RoundUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}

// web_searchはサーバー側ツールのため、内部の検索反復が10回を超えるとpause_turnで一旦返る。
// 新しいuser発言を追加せず同じmessagesで再送すると続きから再開する
export async function runUntilComplete(
  client: Anthropic,
  systemPrompt: string,
  messages: MessageParam[],
): Promise<{ message: Anthropic.Message; usage: RoundUsage }> {
  const aggregated: RoundUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
  let working = [...messages];
  let message: Anthropic.Message;

  for (;;) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: working,
    });
    message = await stream.finalMessage();

    const roundUsage = toRoundUsage(message.usage);
    aggregated.inputTokens += roundUsage.inputTokens;
    aggregated.outputTokens += roundUsage.outputTokens;
    aggregated.cacheCreationInputTokens += roundUsage.cacheCreationInputTokens;
    aggregated.cacheReadInputTokens += roundUsage.cacheReadInputTokens;

    if (message.stop_reason !== "pause_turn") break;
    working = [...working, { role: "assistant", content: message.content }];
  }

  return { message, usage: aggregated };
}
