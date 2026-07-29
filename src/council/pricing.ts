import type { RoundUsage } from "./types";

export const MODEL = "claude-opus-4-8";

// Opus 4.8: $5/$25 per 1Mトークン(2026-07時点、claude-apiスキルのキャッシュ値)。
// 円換算は行わない。円換算はledger.ts(記帳時に外部APIから実勢レートを取得)に一任する
export const INPUT_PER_M = 5;
export const OUTPUT_PER_M = 25;
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

// web_searchサーバーツールの課金: $10/1,000検索(トークン課金とは別建て、2026-07-29 Perplexityではなく
// 公式ドキュメントで確認・裏取り済み)。エラー時のweb_search呼び出しは実際には課金されないが、
// usage.server_tool_use.web_search_requestsは成功分のみをカウントするため区別不要
export const WEB_SEARCH_COST_PER_SEARCH_USD = 10 / 1000;

export function addUsage(a: RoundUsage, b: RoundUsage): RoundUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    webSearchRequests: a.webSearchRequests + b.webSearchRequests,
  };
}

export function computeUsageCostUsd(usage: RoundUsage): number {
  return (
    (usage.inputTokens * INPUT_PER_M) / 1_000_000 +
    (usage.outputTokens * OUTPUT_PER_M) / 1_000_000 +
    (usage.cacheCreationInputTokens * INPUT_PER_M * CACHE_WRITE_MULTIPLIER) / 1_000_000 +
    (usage.cacheReadInputTokens * INPUT_PER_M * CACHE_READ_MULTIPLIER) / 1_000_000 +
    usage.webSearchRequests * WEB_SEARCH_COST_PER_SEARCH_USD
  );
}
