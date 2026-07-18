import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { buildSystemPrompt, extractText, runUntilComplete } from "./councilCore";
import { computeUsageCostUsd } from "./pricing";
import { appendExpense } from "../lib/ledger";
import type { Candidate, CouncilResult, CouncilScoreItem, CouncilVerdictLabel } from "./types";

function buildCandidatePrompt(candidate: Candidate): string {
  return `テーマ候補の審議依頼です。テーマHの差分検知(Hacker News Show/Ask HN・Product Hunt・
はてなブックマーク等)の直近7日分の生データから、選定評議会が深掘りに値すると判断した候補です。

- キーワード: ${candidate.topic}
- 選定評議会による選定理由: ${candidate.rationale}
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
  const totalUsage = {
    inputTokens: round1.usage.inputTokens + round2.usage.inputTokens,
    outputTokens: round1.usage.outputTokens + round2.usage.outputTokens,
    cacheCreationInputTokens: round1.usage.cacheCreationInputTokens + round2.usage.cacheCreationInputTokens,
    cacheReadInputTokens: round1.usage.cacheReadInputTokens + round2.usage.cacheReadInputTokens,
  };
  const verdict = parsed?.verdict ?? "保留";
  const estimatedCostUsd = computeUsageCostUsd(totalUsage);

  let estimatedCostJpy: number | null = null;
  try {
    const entry = await appendExpense({
      category: "api",
      service: "council-opus",
      amountUsd: estimatedCostUsd,
      amountJpy: null,
      description: `評議会(判断) "${candidate.topic}" → 裁定=${verdict}`,
      occurredAt: new Date().toISOString(),
    });
    estimatedCostJpy = entry.amountJpy;
  } catch (err) {
    console.error(
      `[council/judge] ledger記帳に失敗しました(評議会自体は続行、要手動確認): topic="${candidate.topic}" error=${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  return {
    topic: candidate.topic,
    candidate,
    verdict,
    scoreTable: parsed?.scoreTable ?? [],
    round1Text,
    round2Text,
    auditorComment: parsed?.auditorComment ?? "(JSON裁定のパースに失敗したため、round2Textを直接確認してください)",
    usage: { round1: round1.usage, round2: round2.usage },
    estimatedCostUsd,
    estimatedCostJpy,
    generatedAt: new Date().toISOString(),
    ...(parsed ? {} : { parseError: "verdict_json_parse_failed" }),
  };
}
