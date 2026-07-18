export interface CandidateItem {
  title: string;
  url: string;
  sourceCompanyName: string;
  publishedAt?: string;
}

export interface Candidate {
  topic: string;
  // 選定評議会がこの候補を選んだ理由(頻度カウントではなくAIの目利きによる説明)
  rationale: string;
  sourceUrls: string[];
  excerpt: string;
}

export interface RoundUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface CouncilScoreItem {
  criterion: string;
  assessment: string;
}

export type CouncilVerdictLabel = "採択" | "却下" | "保留";

export interface SelectionResult {
  candidates: Candidate[];
  round1Text: string;
  round2Text: string;
  auditorComment: string;
  usage: {
    round1: RoundUsage;
    round2: RoundUsage;
  };
  estimatedCostUsd: number;
  // 記帳時にledger.tsが取得した実勢レートでの円換算。記帳自体が失敗した場合はnull
  estimatedCostJpy: number | null;
  generatedAt: string;
  parseError?: string;
}

export interface CouncilResult {
  topic: string;
  candidate: Candidate;
  verdict: CouncilVerdictLabel;
  scoreTable: CouncilScoreItem[];
  round1Text: string;
  round2Text: string;
  auditorComment: string;
  usage: {
    round1: RoundUsage;
    round2: RoundUsage;
  };
  estimatedCostUsd: number;
  estimatedCostJpy: number | null;
  generatedAt: string;
  parseError?: string;
}
