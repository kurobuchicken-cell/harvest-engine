export interface CandidateItem {
  title: string;
  url: string;
  sourceCompanyName: string;
}

export interface Candidate {
  topic: string;
  score: number;
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
  estimatedCostJpy: number;
  generatedAt: string;
  parseError?: string;
}
