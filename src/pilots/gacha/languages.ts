import type { MakerId } from "./types";

export const CATEGORIES = ["figure", "mascot_keychain", "plush", "miniature", "accessory", "stationery_goods", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface LanguageConfig {
  code: string; // BCP47。htmlのlang属性・hreflang・出力ディレクトリ名に使う
  nameForAi: string | null; // AI翻訳の指示に使う言語名。null=原文(日本語)のため翻訳しない
  label: string; // 言語切替リンクの表示名
  ui: {
    siteName: string;
    tagline: string;
    upcoming: string;
    byMonth: string;
    byMaker: string;
    byFranchise: string;
    monthTitle: (month: string) => string;
    makerTitle: (maker: string) => string;
    franchiseTitle: (franchise: string) => string;
    monthDescription: (month: string, count: number) => string;
    makerDescription: (maker: string, count: number) => string;
    franchiseDescription: (franchise: string, count: number) => string;
    indexDescription: string;
    labelSep: string; // 「価格：」の区切り。仏語はコロンの前に空白を入れる正書法のため言語ごとに持つ
    price: string;
    release: string;
    officialLink: string;
    resale: string;
    originalName: string;
    releaseFromWeek: (month: string, week: number) => string;
    releaseWeekOf: (date: string) => string;
    releaseMonthOnly: (month: string) => string;
    releaseTba: string;
    disclaimer: string;
    machineTranslated: string | null;
    sourceCredit: Record<MakerId, string>;
  };
  makers: Record<MakerId, string>;
  categories: Record<Category, string>;
}

const monthName = (locale: string, month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString(locale, { year: "numeric", month: "long", timeZone: "UTC" });
const dayName = (locale: string, date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// 仏語は母音で始まる月名(avril/août/octobre)の前で de を d' に縮約する
const frenchOf = (month: string) => (/^[aeiouâéè]/i.test(month) ? `d'${month}` : `de ${month}`);

// 言語の追加はこの配列に1要素足すだけで済む(未翻訳の商品は次回実行時にその言語分だけAIで翻訳される)
export const LANGUAGES: LanguageConfig[] = [
  {
    code: "ja",
    nameForAi: null,
    label: "日本語",
    ui: {
      siteName: "ガチャ新作カレンダー（試作版）",
      tagline: "メーカー公式の発売予定をまとめて確認",
      upcoming: "発売予定",
      byMonth: "月別",
      byMaker: "メーカー別",
      byFranchise: "作品別",
      monthTitle: (m) => `${monthName("ja-JP", m)}発売のガチャ新作一覧`,
      makerTitle: (mk) => `${mk}のガチャ新作一覧`,
      franchiseTitle: (f) => `${f}のガチャ新作一覧`,
      monthDescription: (m, n) => `${monthName("ja-JP", m)}に発売予定のガチャ${n}件をメーカー横断で掲載。`,
      makerDescription: (mk, n) => `${mk}のガチャ新作・発売予定${n}件を発売時期順に掲載。`,
      franchiseDescription: (f, n) => `${f}のガチャ新作・発売予定${n}件をメーカー横断で掲載。`,
      indexDescription: "タカラトミーアーツなどのガチャ新作の発売予定を、月別・メーカー別・作品別にまとめています。",
      labelSep: "：",
      price: "価格",
      release: "発売",
      officialLink: "公式ページ",
      resale: "再販",
      originalName: "原題",
      releaseFromWeek: (m, w) => `${monthName("ja-JP", m)}第${w}週より順次`,
      releaseWeekOf: (d) => `${dayName("ja-JP", d)}の週`,
      releaseMonthOnly: (m) => `${monthName("ja-JP", m)}`,
      releaseTba: "発売時期未定",
      disclaimer: "本サイトは各メーカーの公式サイトの公開情報(商品名・価格・発売時期)をもとに自動で整理した非公式の情報サイトで、各メーカーとは関係ありません。最新情報は必ず公式ページでご確認ください。",
      machineTranslated: null,
      sourceCredit: { bandai: "出典：ガシャポンオフィシャルサイト（バンダイ）", "takaratomy-arts": "出典：タカラトミーアーツ公式サイト" },
    },
    makers: { bandai: "バンダイ（ガシャポン）", "takaratomy-arts": "タカラトミーアーツ" },
    categories: {
      figure: "フィギュア", mascot_keychain: "マスコット・キーホルダー", plush: "ぬいぐるみ", miniature: "ミニチュア",
      accessory: "アクセサリー・雑貨", stationery_goods: "文具・グッズ", other: "その他",
    },
  },
  {
    code: "en",
    nameForAi: "English",
    label: "English",
    ui: {
      siteName: "Japan Gacha Release Calendar (beta)",
      tagline: "Upcoming capsule toys from official Japanese makers, in one place",
      upcoming: "Upcoming releases",
      byMonth: "By month",
      byMaker: "By maker",
      byFranchise: "By franchise",
      monthTitle: (m) => `Japanese gacha releases — ${monthName("en-US", m)}`,
      makerTitle: (mk) => `${mk} gacha releases`,
      franchiseTitle: (f) => `${f} gacha releases in Japan`,
      monthDescription: (m, n) => `${n} capsule toys releasing in Japan in ${monthName("en-US", m)}, from Takara Tomy A.R.T.S and more.`,
      makerDescription: (mk, n) => `${n} upcoming and recent ${mk} capsule toy releases in Japan.`,
      franchiseDescription: (f, n) => `${n} upcoming and recent ${f} capsule toys (gacha) released in Japan.`,
      indexDescription: "Upcoming Japanese capsule toy (gacha) releases from official makers, by month, maker and franchise.",
      labelSep: ": ",
      price: "Price",
      release: "Release",
      officialLink: "Official page (Japanese)",
      resale: "Re-release",
      originalName: "Japanese name",
      releaseFromWeek: (m, w) => `From week ${w} of ${monthName("en-US", m)}`,
      releaseWeekOf: (d) => `Week of ${dayName("en-US", d)}`,
      releaseMonthOnly: (m) => monthName("en-US", m),
      releaseTba: "Date TBA",
      disclaimer: "This is an unofficial fan information site, not affiliated with any manufacturer. Product names, prices and release dates are compiled automatically from the makers' official Japanese websites. Always check the official page for the latest information.",
      machineTranslated: "Product names are machine-translated from Japanese.",
      sourceCredit: { bandai: "Source: Gashapon official site (Bandai)", "takaratomy-arts": "Source: Takara Tomy A.R.T.S official site" },
    },
    makers: { bandai: "Bandai (Gashapon)", "takaratomy-arts": "Takara Tomy A.R.T.S" },
    categories: {
      figure: "Figure", mascot_keychain: "Mascot / keychain", plush: "Plush", miniature: "Miniature",
      accessory: "Accessory", stationery_goods: "Stationery / goods", other: "Other",
    },
  },
  {
    code: "fr",
    nameForAi: "French",
    label: "Français",
    ui: {
      siteName: "Calendrier des gachas japonais (bêta)",
      tagline: "Les nouveautés capsule toys des fabricants officiels japonais, au même endroit",
      upcoming: "Prochaines sorties",
      byMonth: "Par mois",
      byMaker: "Par fabricant",
      byFranchise: "Par licence",
      monthTitle: (m) => `Sorties de gachas au Japon — ${monthName("fr-FR", m)}`,
      makerTitle: (mk) => `Sorties de gachas ${mk}`,
      franchiseTitle: (f) => `Gachas ${f} au Japon`,
      monthDescription: (m, n) => `${n} capsule toys qui sortent au Japon en ${monthName("fr-FR", m)} : Takara Tomy A.R.T.S et plus.`,
      makerDescription: (mk, n) => `${n} sorties récentes et à venir de capsule toys ${mk} au Japon.`,
      franchiseDescription: (f, n) => `${n} capsule toys (gacha) ${f} récents et à venir au Japon.`,
      indexDescription: "Les prochaines sorties de capsule toys japonais (gacha) des fabricants officiels, par mois, fabricant et licence.",
      labelSep: " : ",
      price: "Prix",
      release: "Sortie",
      officialLink: "Page officielle (japonais)",
      resale: "Réédition",
      originalName: "Nom japonais",
      releaseFromWeek: (m, w) => `À partir de la semaine ${w} ${frenchOf(monthName("fr-FR", m))}`,
      releaseWeekOf: (d) => `Semaine du ${dayName("fr-FR", d)}`,
      releaseMonthOnly: (m) => monthName("fr-FR", m),
      releaseTba: "Date à confirmer",
      disclaimer: "Site d'information non officiel, sans lien avec les fabricants. Les noms, prix et dates de sortie sont compilés automatiquement à partir des sites officiels japonais des fabricants. Vérifiez toujours la page officielle pour les dernières informations.",
      machineTranslated: "Les noms des produits sont traduits automatiquement du japonais.",
      sourceCredit: { bandai: "Source : site officiel Gashapon (Bandai)", "takaratomy-arts": "Source : site officiel Takara Tomy A.R.T.S" },
    },
    makers: { bandai: "Bandai (Gashapon)", "takaratomy-arts": "Takara Tomy A.R.T.S" },
    categories: {
      figure: "Figurine", mascot_keychain: "Mascotte / porte-clés", plush: "Peluche", miniature: "Miniature",
      accessory: "Accessoire", stationery_goods: "Papeterie / goodies", other: "Autre",
    },
  },
];

export const TRANSLATED_LANGUAGES = LANGUAGES.filter((l) => l.nameForAi !== null);
