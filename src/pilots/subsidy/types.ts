export type SubsidySource = "jgrants" | "jnet21";

export interface SubsidyItem {
  id: string; // `${source}:${元ID}`
  source: SubsidySource;
  title: string;
  url: string;
  institution: string | null;
  kind: "grant" | "loan";
  regions: string[]; // 都道府県名、または "全国"
  industries: string[]; // taxonomy.INDUSTRIES の値。空=業種の制約なし
  purposes: string[]; // taxonomy.PURPOSES の値
  targetEmployees: string | null;
  maxAmountYen: number | null;
  acceptanceStart: string | null;
  acceptanceEnd: string | null;
  // jGrants一覧APIの締切値。詳細APIと食い違う案件があるため、再取得要否の判定は一覧側の値同士で行う
  listAcceptanceEnd?: string | null;
  publishedAt: string | null;
  // 分類の出どころ。jGrantsはAPIの構造化項目、J-Net21はAI分類
  classifiedBy: "source" | "ai" | "pending";
  firstSeenAt: string;
  lastSeenAt: string;
  // jGrantsの業種・地域・目的の元の値。分類表を直したときに再取得せず正規化し直せるよう保持する
  sourceFields?: { industry: string | null; area: string | null; purpose: string | null };
  // J-Net21の本文はAI分類の入力にのみ使い、ページには出さない(J-Net21利用規約で転載禁止のため)
  rawText?: string;
}
