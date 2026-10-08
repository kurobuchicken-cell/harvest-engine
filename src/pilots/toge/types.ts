// unknownは「解除予定日を過ぎたが解除の明記がない」など、発表からは今の状態を言い切れないもの
export type RowStatus = "closing_planned" | "closed" | "open" | "unknown";
export type Certainty = "confirmed" | "planned" | "undecided";
export type ClosureReason = "winter" | "disaster" | "construction" | "weather" | "other";

// 発表から取り出した1区間。文章は持たず事実だけ(規約方針: 仕様書4章)。
// 状態はAIに判断させず、日付と解除の明記から名寄せの時にコードで決める(AIは基準日との前後を取り違えるため)
export interface TogeRow {
  route: string;
  section: string;
  passNames: string[];
  reason: ClosureReason;
  reopenedExplicit: boolean;
  closeAt: string | null; // YYYY-MM-DD または YYYY-MM-DDTHH:mm(JST)
  reopenAt: string | null;
  reopenCertainty: Certainty;
  vehicles: string | null;
  note: string | null;
}

export interface WatchedDoc {
  url: string;
  kind: "pdf" | "image";
  hash: string;
}

// 発表ページ1件の見張り状態。idはsources.tsのid
export interface TogePage {
  id: string;
  publisherId: string;
  url: string;
  textHash: string | null;
  docs: WatchedDoc[];
  contentHash: string | null; // 本文と添付(PDF・画像)をまとめたハッシュ。これが変わった時だけAIに回す
  analyzedHash: string | null;
  status: "pending" | "analyzed" | "error";
  errorCount: number;
  lastError: string | null;
  checkedAt: string | null;
  changedAt: string | null;
  analyzedAt: string | null;
  announcedAt: string | null;
  rows: TogeRow[];
}

// 峠マスタ1件=1区間。keysは「発行元|路線|区間」を正規化した文字列で、名寄せの一致に使う
export interface PassMaster {
  id: string;
  name: string;
  aliases: string[];
  prefecture: string;
  route: string;
  section: string;
  keys: string[];
  lat?: number;
  lng?: number;
}

export interface PassState {
  passId: string;
  status: RowStatus;
  closeAt: string | null;
  reopenAt: string | null;
  reopenCertainty: Certainty;
  vehicles: string | null;
  sourceId: string;
  changedAt: string;
}

export type EventType = "reopen_announced" | "reopen_changed" | "reopened" | "closing_announced" | "closed";

export interface TogeEvent {
  passId: string;
  type: EventType;
  before: PassState | null;
  after: PassState;
  detectedAt: string;
}
