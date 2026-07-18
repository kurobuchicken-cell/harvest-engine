import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { buildSystemPrompt, extractText, runUntilComplete } from "./councilCore";
import { computeUsageCostUsd } from "./pricing";
import { appendExpense } from "../lib/ledger";
import type { Candidate, CandidateItem, SelectionResult } from "./types";

const MAX_CANDIDATES_TO_SELECT = 5;

function formatItemsList(items: CandidateItem[]): string {
  return items
    .map((item, i) => {
      const date = item.publishedAt ? `, ${item.publishedAt}` : "";
      return `${i + 1}. [${item.sourceCompanyName}${date}] ${item.title} (${item.url})`;
    })
    .join("\n");
}

function buildSelectionRound1Prompt(items: CandidateItem[]): string {
  return `候補選定の依頼です。テーマH(ビジネスヒントのメタ・ハーヴェスト)の各ソースから、
直近7日間で収集された生データ(重複除去済み、${items.length}件)を以下に示します。
このデータの中から、単純な出現頻度ではなく、皆さんそれぞれの専門視点で
「新テーマとして深掘りする価値があるパターン・兆候」を見つけてください。

--- 生データ ---
${formatItemsList(items)}
--- 生データここまで ---

Round1として、各役(市場戦略家/リスク管理官/ハーヴェスト理論の番人/地域リサーチャー/
運用・財務担当)がこのデータを見て、それぞれの視点で有望だと思う候補を挙げてください。
地域リサーチャーは気になる候補についてweb_searchで実際に裏取りしてください。
1つの候補が複数のアイテムにまたがる抽象的なパターン(例: 特定の技術トレンド・特定の
業界の悩み)でも構いません。監査役の発言はRound2で行います。`;
}

const SELECTION_ROUND2_INSTRUCTION = `Round2です。Round1で各役が挙げた候補を踏まえ、以下を行ってください。
1. 各役の推薦を交差検証し、重複や関連するものは統合する
2. 監査役が「既存資産・直前の結論へのアンカリングがないか、特定分野への偏りがないか」の
   監査コメントを述べる(必須)
3. 最終的に、深掘り調査に値する候補を**最大${MAX_CANDIDATES_TO_SELECT}件**に絞り込み、
   以下の形式のfenced codeブロック(\`\`\`json)で出力する。このJSONのみが機械的に
   パースされるので、必ず有効なJSONにすること。候補が${MAX_CANDIDATES_TO_SELECT}件に
   満たない場合は無理に埋めず、本当に有望なものだけを残すこと

\`\`\`json
{
  "candidates": [
    {
      "topic": "候補の名称(短い見出し)",
      "rationale": "なぜこれを選んだか(頻度ではなく質的な理由)",
      "sourceUrls": ["元データのURL(最大3件)"],
      "excerpt": "根拠となった元タイトルの抜粋"
    }
  ],
  "auditorComment": "監査役コメントの本文"
}
\`\`\``;

function parseSelectionJson(text: string): { candidates: Candidate[]; auditorComment: string } | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed.candidates) || !parsed.auditorComment) return null;
    for (const c of parsed.candidates) {
      if (!c.topic || !c.rationale || !Array.isArray(c.sourceUrls) || !c.excerpt) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// 頻度カウントによる機械的な絞り込みの代わりに、評議会自身に生データを見せて
// 「どのテーマを深掘りすべきか」を目利きさせる選定専用の評議会。
// 採否そのものはこの後の既存judgeフロー(runCouncilForTopic、無改修)が担う
export async function selectCandidates(items: CandidateItem[]): Promise<SelectionResult> {
  const client = new Anthropic();
  const systemPrompt = await buildSystemPrompt();

  const round1Messages: MessageParam[] = [{ role: "user", content: buildSelectionRound1Prompt(items) }];
  const round1 = await runUntilComplete(client, systemPrompt, round1Messages);
  const round1Text = extractText(round1.message.content);

  const round2Messages: MessageParam[] = [
    ...round1Messages,
    { role: "assistant", content: round1.message.content },
    { role: "user", content: SELECTION_ROUND2_INSTRUCTION },
  ];
  const round2 = await runUntilComplete(client, systemPrompt, round2Messages);
  const round2Text = extractText(round2.message.content);

  const parsed = parseSelectionJson(round2Text);
  const totalUsage = {
    inputTokens: round1.usage.inputTokens + round2.usage.inputTokens,
    outputTokens: round1.usage.outputTokens + round2.usage.outputTokens,
    cacheCreationInputTokens: round1.usage.cacheCreationInputTokens + round2.usage.cacheCreationInputTokens,
    cacheReadInputTokens: round1.usage.cacheReadInputTokens + round2.usage.cacheReadInputTokens,
  };
  const estimatedCostUsd = computeUsageCostUsd(totalUsage);

  let estimatedCostJpy: number | null = null;
  try {
    const entry = await appendExpense({
      category: "api",
      service: "council-opus",
      amountUsd: estimatedCostUsd,
      amountJpy: null,
      description: `評議会(選定) 生データ${items.length}件から候補${parsed?.candidates.length ?? 0}件を選定`,
      occurredAt: new Date().toISOString(),
    });
    estimatedCostJpy = entry.amountJpy;
  } catch (err) {
    console.error(
      `[council/select] ledger記帳に失敗しました(評議会自体は続行、要手動確認): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return {
    candidates: parsed?.candidates ?? [],
    round1Text,
    round2Text,
    auditorComment: parsed?.auditorComment ?? "(JSON選定結果のパースに失敗したため、round2Textを直接確認してください)",
    usage: { round1: round1.usage, round2: round2.usage },
    estimatedCostUsd,
    estimatedCostJpy,
    generatedAt: new Date().toISOString(),
    ...(parsed ? {} : { parseError: "selection_json_parse_failed" }),
  };
}
