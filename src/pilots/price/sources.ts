export interface PriceSource {
  id: string; // ページのslugにも使う
  company: string;
  listUrl: string; // ニュースリリース一覧(SSRでリンクが取れることを確認済みのもの)
  suspended?: string; // 停止理由。設定した社は収集・AI抽出・掲載をしない
}

// 会社の追加はここに1行足すだけ。2026-10-05に一覧のSSR・robots.txt・既知AIボット名指しDisallowなしを確認済み
export const SOURCES: PriceSource[] = [
  { id: "meiji", company: "明治", listUrl: "https://www.meiji.co.jp/corporate/pressrelease/" },
  { id: "kewpie", company: "キユーピー", listUrl: "https://www.kewpie.com/newsrelease/" },
  { id: "megmilk", company: "雪印メグミルク", listUrl: "https://www.meg-snow.com/news/" },
  { id: "kagome", company: "カゴメ", listUrl: "https://www.kagome.co.jp/company/news/" },
  { id: "nestle", company: "ネスレ日本", listUrl: "https://www.nestle.co.jp/media/pressreleases" },
  { id: "toyosuisan", company: "東洋水産", listUrl: "https://www.maruchan.co.jp/news_topics/news.html" },
  { id: "mizkan", company: "ミツカン", listUrl: "https://www.mizkan.co.jp/company/newsrelease/" },
  { id: "asahiinryo", company: "アサヒ飲料", listUrl: "https://www.asahiinryo.co.jp/company/newsrelease/" },
  { id: "nipponham", company: "日本ハム", listUrl: "https://www.nipponham.co.jp/news/" },
  { id: "nisshin-oillio", company: "日清オイリオ", listUrl: "https://www.nisshin-oillio.com/company/news/" },
  { id: "marumiya", company: "丸美屋", listUrl: "https://www.marumiya.co.jp/news/" },
  { id: "nisshin-welna", company: "日清製粉ウェルナ", listUrl: "https://www.nisshin-seifun-welna.com/index/release/", suspended: "サイトの利用規約に営利・商業目的の利用を制限する文言があり、原文精読まで停止(2026-10-06)" },
  { id: "fujiya", company: "不二家", listUrl: "https://www.fujiya-peko.co.jp/company/news/", suspended: "サイトの利用規約に営利・商業目的の利用を制限する文言があり、原文精読まで停止(2026-10-06)" },
  { id: "pokkasapporo", company: "ポッカサッポロ", listUrl: "https://www.pokkasapporo-fb.jp/company/news/" },
  { id: "itoham", company: "伊藤ハム", listUrl: "https://www.itoham.co.jp/news/" },
  { id: "yakult", company: "ヤクルト", listUrl: "https://www.yakult.co.jp/company/news/" },
  { id: "morinaga", company: "森永製菓", listUrl: "https://www.morinaga.co.jp/company/newsrelease/", suspended: "サイトの利用規約に営利・商業目的の利用を制限する文言があり、原文精読まで停止(2026-10-06)" },
  { id: "nissin", company: "日清食品ホールディングス", listUrl: "https://www.nissin.com/jp/news/", suspended: "サイトの利用規約に営利・商業目的の利用を制限する文言があり、原文精読まで停止(2026-10-06)" },
  { id: "itoen", company: "伊藤園", listUrl: "https://www.itoen.co.jp/news/" },
  { id: "ucc", company: "UCC", listUrl: "https://www.ucc.co.jp/company/news/index.html" },
  { id: "unicharm", company: "ユニ・チャーム", listUrl: "https://www.unicharm.co.jp/ja/company/news.html", suspended: "サイトの利用規約に営利・商業目的の利用を制限する文言があり、原文精読まで停止(2026-10-06)" },
];

export const ACTIVE_SOURCES = SOURCES.filter((s) => !s.suspended);
