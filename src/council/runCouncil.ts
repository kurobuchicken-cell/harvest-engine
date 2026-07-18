import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { Candidate, CouncilResult, CouncilScoreItem, CouncilVerdictLabel, RoundUsage } from "./types";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 16000;

// Opus 4.8: $5/$25 per 1Mトークン(2026-07時点、claude-apiスキルのキャッシュ値)。1ドル150円換算の概算
const USD_TO_JPY = 150;
const INPUT_PER_M = 5;
const OUTPUT_PER_M = 25;
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

let governanceCache: string | null = null;

async function loadGovernance(): Promise<string> {
  if (governanceCache) return governanceCache;
  governanceCache = await readFile(path.resolve(process.cwd(), "GOVERNANCE.md"), "utf-8");
  return governanceCache;
}

async function buildSystemPrompt(): Promise<string> {
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

function extractText(content: ContentBlockParam[] | Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

function toRoundUsage(usage: Anthropic.Usage): RoundUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}

function computeCostJpy(usage: RoundUsage): number {
  const usd =
    (usage.inputTokens * INPUT_PER_M) / 1_000_000 +
    (usage.outputTokens * OUTPUT_PER_M) / 1_000_000 +
    (usage.cacheCreationInputTokens * INPUT_PER_M * CACHE_WRITE_MULTIPLIER) / 1_000_000 +
    (usage.cacheReadInputTokens * INPUT_PER_M * CACHE_READ_MULTIPLIER) / 1_000_000;
  return usd * USD_TO_JPY;
}

// web_searchはサーバー側ツールのため、内部の検索反復が10回を超えるとpause_turnで一旦返る。
// 新しいuser発言を追加せず同じmessagesで再送すると続きから再開する
async function runUntilComplete(
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

function buildCandidatePrompt(candidate: Candidate): string {
  return `テーマ候補の調査依頼です。テーマHの差分検知(Hacker News Show/Ask HN・Product Hunt・はてなブックマーク)から抽出された、直近7日間で頻出したキーワードです。

- キーワード: ${candidate.topic}
- 出現件数(候補元アイテム数): ${candidate.score}
- 元記事タイトル抜粋: ${candidate.excerpt}
- 出典URL: ${candidate.sourceUrls.join(", ")}

このキーワードが「新テーマとして調査に値するビジネスヒント」かどうかを審議してください。
Round1として、各役(市場戦略家/リスク管理官/ハーヴェスト理論の番人/地域リサーチャー/運用・財務担当)の初期見解を述べてください。地域リサーチャーはweb_searchで実際に裏取りしてください。監査役の発言はRound2で行います。`;
}

const ROUND2_INSTRUCTION = `Round2です。Round1の各役の発言を踏まえ、以下を行ってください。
1. 各役が互いの見解を交差検証する(反論・補強)
2. 監査役が「既存資産・直前の結論へのアンカリングがないか」の監査コメントを述べる(必須)
3. 最後に、以下の形式のfenced codeブロック(\`\`\`json)で最終裁定を出力する。このJSONのみが機械的にパースされるので、必ず有効なJSONにすること

\`\`\`json
{
  "verdict": "採択" | "却下" | "保留",
  "scoreTable": [
    { "criterion": "市場規模・買い手仮説", "assessment": "..." },
    { "criterion": "法務・robots.txt/ToSリスク", "assessment": "..." },
    { "criterion": "ポートフォリオ制とのフィット", "assessment": "..." },
    { "criterion": "地域適合(日本/海外)", "assessment": "..." },
    { "criterion": "収集コスト・運用負荷", "assessment": "..." }
  ],
  "auditorComment": "監査役コメントの本文"
}
\`\`\``;

function parseVerdictJson(text: string): {
  verdict: CouncilVerdictLabel;
  scoreTable: CouncilScoreItem[];
  auditorComment: string;
} | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed.verdict || !Array.isArray(parsed.scoreTable) || !parsed.auditorComment) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function runCouncilForTopic(candidate: Candidate): Promise<CouncilResult> {
  const client = new Anthropic();
  const systemPrompt = await buildSystemPrompt();

  const round1Messages: MessageParam[] = [{ role: "user", content: buildCandidatePrompt(candidate) }];
  const round1 = await runUntilComplete(client, systemPrompt, round1Messages);
  const round1Text = extractText(round1.message.content);

  const round2Messages: MessageParam[] = [
    ...round1Messages,
    { role: "assistant", content: round1.message.content },
    { role: "user", content: ROUND2_INSTRUCTION },
  ];
  const round2 = await runUntilComplete(client, systemPrompt, round2Messages);
  const round2Text = extractText(round2.message.content);

  const parsed = parseVerdictJson(round2Text);
  const totalUsage: RoundUsage = {
    inputTokens: round1.usage.inputTokens + round2.usage.inputTokens,
    outputTokens: round1.usage.outputTokens + round2.usage.outputTokens,
    cacheCreationInputTokens: round1.usage.cacheCreationInputTokens + round2.usage.cacheCreationInputTokens,
    cacheReadInputTokens: round1.usage.cacheReadInputTokens + round2.usage.cacheReadInputTokens,
  };

  return {
    topic: candidate.topic,
    candidate,
    verdict: parsed?.verdict ?? "保留",
    scoreTable: parsed?.scoreTable ?? [],
    round1Text,
    round2Text,
    auditorComment: parsed?.auditorComment ?? "(JSON裁定のパースに失敗したため、round2Textを直接確認してください)",
    usage: { round1: round1.usage, round2: round2.usage },
    estimatedCostJpy: computeCostJpy(totalUsage),
    generatedAt: new Date().toISOString(),
    ...(parsed ? {} : { parseError: "verdict_json_parse_failed" }),
  };
}
