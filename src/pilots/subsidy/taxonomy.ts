export const NATIONWIDE = "全国";

export const PREFECTURES: { name: string; slug: string }[] = [
  ["北海道", "hokkaido"], ["青森県", "aomori"], ["岩手県", "iwate"], ["宮城県", "miyagi"], ["秋田県", "akita"],
  ["山形県", "yamagata"], ["福島県", "fukushima"], ["茨城県", "ibaraki"], ["栃木県", "tochigi"], ["群馬県", "gunma"],
  ["埼玉県", "saitama"], ["千葉県", "chiba"], ["東京都", "tokyo"], ["神奈川県", "kanagawa"], ["新潟県", "niigata"],
  ["富山県", "toyama"], ["石川県", "ishikawa"], ["福井県", "fukui"], ["山梨県", "yamanashi"], ["長野県", "nagano"],
  ["岐阜県", "gifu"], ["静岡県", "shizuoka"], ["愛知県", "aichi"], ["三重県", "mie"], ["滋賀県", "shiga"],
  ["京都府", "kyoto"], ["大阪府", "osaka"], ["兵庫県", "hyogo"], ["奈良県", "nara"], ["和歌山県", "wakayama"],
  ["鳥取県", "tottori"], ["島根県", "shimane"], ["岡山県", "okayama"], ["広島県", "hiroshima"], ["山口県", "yamaguchi"],
  ["徳島県", "tokushima"], ["香川県", "kagawa"], ["愛媛県", "ehime"], ["高知県", "kochi"], ["福岡県", "fukuoka"],
  ["佐賀県", "saga"], ["長崎県", "nagasaki"], ["熊本県", "kumamoto"], ["大分県", "oita"], ["宮崎県", "miyazaki"],
  ["鹿児島県", "kagoshima"], ["沖縄県", "okinawa"],
].map(([name, slug]) => ({ name, slug }));

// 日本標準産業分類の大分類(jGrantsの業種項目と同じ体系)。区切りの「、」「，」揺れは比較時に吸収する
export const INDUSTRIES: { name: string; slug: string }[] = [
  ["農業、林業", "agriculture"], ["漁業", "fishery"], ["鉱業、採石業、砂利採取業", "mining"],
  ["建設業", "construction"], ["製造業", "manufacturing"], ["電気・ガス・熱供給・水道業", "utilities"],
  ["情報通信業", "ict"], ["運輸業、郵便業", "transport"], ["卸売業、小売業", "retail"],
  ["金融業、保険業", "finance"], ["不動産業、物品賃貸業", "realestate"],
  ["学術研究、専門・技術サービス業", "professional"], ["宿泊業、飲食サービス業", "hospitality"],
  ["生活関連サービス業、娯楽業", "lifestyle"], ["教育、学習支援業", "education"], ["医療、福祉", "medical"],
  ["複合サービス事業", "compound"], ["サービス業（他に分類されないもの）", "services"],
  ["公務（他に分類されるものを除く）", "public"],
].map(([name, slug]) => ({ name, slug }));

// jGrantsの対象地域は地方ブロック名でも指定されるため、構成都道府県に展開する
const REGION_BLOCKS: Record<string, string[]> = {
  北海道地方: ["北海道"],
  東北地方: ["青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  "関東・甲信越地方": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "山梨県", "新潟県", "長野県"],
  "東海・北陸地方": ["富山県", "石川県", "福井県", "岐阜県", "静岡県", "愛知県", "三重県"],
  近畿地方: ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  中国地方: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
  四国地方: ["徳島県", "香川県", "愛媛県", "高知県"],
  "九州・沖縄地方": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"],
};

// 大分類19種のうちこれ以上を列挙した案件は、実質「業種を問わない」とみなして業種を空にする。
// そうしないと全業種の組み合わせページに同じ案件が並び、中身の重複したページが大量にできる
const ANY_INDUSTRY_THRESHOLD = 16;
const IGNORED_INDUSTRIES = new Set(["分類不能の産業"]);

// jGrantsの利用目的項目の選択肢をそのまま採用する(J-Net21のAI分類もこの語彙に寄せる)
export const PURPOSES: { name: string; slug: string }[] = [
  ["新たな事業を行いたい", "new-business"], ["販路拡大・海外展開をしたい", "sales-expansion"],
  ["イベント・事業運営支援がほしい", "event"], ["事業を引き継ぎたい", "succession"],
  ["研究開発・実証事業を行いたい", "rnd"], ["人材育成を行いたい", "training"],
  ["資金繰りを改善したい", "cashflow"], ["設備整備・IT導入をしたい", "equipment-it"],
  ["雇用・職場環境を改善したい", "employment"], ["エコ・SDGs活動支援がほしい", "eco"],
  ["災害（自然災害、感染症等）支援がほしい", "disaster"], ["教育・子育て・少子化支援がほしい", "childcare"],
  ["スポーツ・文化支援がほしい", "sports-culture"], ["安全・防災対策支援がほしい", "safety"],
  ["まちづくり・地域振興支援がほしい", "community"],
].map(([name, slug]) => ({ name, slug }));

const fold = (s: string) => s.replace(/[，,、]/g, "、").replace(/[()]/g, (c) => (c === "(" ? "（" : "）")).trim();

function normalizeTo(values: string[], vocab: { name: string }[], label: string): string[] {
  const byFolded = new Map(vocab.map((v) => [fold(v.name), v.name]));
  const out = new Set<string>();
  for (const value of values) {
    const hit = byFolded.get(fold(value));
    if (hit) out.add(hit);
    else unknownValues.add(`${label}:${value}`);
  }
  return [...out];
}

// 語彙に無い値は捨てずに記録し、実行後に一覧表示して語彙の追加漏れに気づけるようにする
export const unknownValues = new Set<string>();

export function normalizeRegions(values: string[]): string[] {
  const names = new Set(PREFECTURES.map((p) => p.name));
  const out = new Set<string>();
  for (const value of values) {
    if (value === NATIONWIDE || names.has(value)) out.add(value);
    else if (REGION_BLOCKS[value]) REGION_BLOCKS[value].forEach((name) => out.add(name));
    else unknownValues.add(`region:${value}`);
  }
  // 47都道府県すべてを列挙した案件は実質全国扱い
  if (out.has(NATIONWIDE) || PREFECTURES.every((p) => out.has(p.name))) return [NATIONWIDE];
  return [...out];
}

export function normalizeIndustries(values: string[]): string[] {
  const normalized = normalizeTo(values.filter((v) => !IGNORED_INDUSTRIES.has(v)), INDUSTRIES, "industry");
  return normalized.length >= ANY_INDUSTRY_THRESHOLD ? [] : normalized;
}

export function normalizePurposes(values: string[]): string[] {
  return normalizeTo(values, PURPOSES, "purpose");
}
