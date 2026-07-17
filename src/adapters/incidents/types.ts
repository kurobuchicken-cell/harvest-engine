export interface ParsedIncident {
  title: string;
  severity: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
}

// レスポンス形状が想定と異なる場合はErrorをthrowする(呼び出し側でparseStatus='failed'にする)
export type IncidentAdapter = (raw: unknown) => ParsedIncident[];
