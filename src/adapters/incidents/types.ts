export interface ParsedIncident {
  title: string;
  severity: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
  sourceUrl: string | null;
}

// レスポンス形状が想定と異なる場合はErrorをthrowする(呼び出し側でparseStatus='failed'にする)
// RSS系アダプタはXMLパースが非同期(rss-parser)のためPromiseも許容する
export type IncidentAdapter = (raw: unknown) => ParsedIncident[] | Promise<ParsedIncident[]>;
