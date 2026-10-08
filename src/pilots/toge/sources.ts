// テーマT(峠の開通通知)の情報源。発行元ごとの規約判定と、発表ページの一覧の2つで管理する。
// 規約は2026-10-08に各発行元のサイトポリシー原文を開いて確認した(仕様書_toge-log.html 4章)。

// 出典リンクの張り先。サイトポリシーの条件に合わせて張り分ける(2026-10-08オーナー決定)
// - page: 発表ページに直接リンクしてよい
// - page-not-pdf: 掲載ページにはリンクしてよいがPDFへの直接リンクは避ける
// - top: トップページ以外へのリンクは問い合わせが必要。発表元は文字で示し、リンクは県のトップページ
export type LinkTarget = "page" | "page-not-pdf" | "top";

export interface TogePublisher {
  id: string;
  name: string;
  termsUrl: string;
  checkedOn?: string; // 原文を確認した日。未設定なら未確認で、収集しない
  license?: string; // 出典表示で商用再利用まで認めるライセンスがある場合のみ
  linkTarget: LinkTarget;
  notifyOnLink?: boolean; // リンクしたら連絡するよう求めている。公開前に連絡文を用意し、送るかはその時にオーナー判断
  note?: string;
}

// 自動取得・AI利用を禁じる条項は、確認したすべての発行元で記載なし。文章・写真は無断転載禁止のため、使うのは事実(路線・区間・日時)のみ
export const PUBLISHERS: TogePublisher[] = [
  { id: "mlit", name: "国土交通省", termsUrl: "https://www.mlit.go.jp/link.html", checkedOn: "2026-10-08", license: "PDL1.0", linkTarget: "page", note: "リンクは新しいウインドウで開く設定にし、国土交通省ウェブサイトへのリンクである旨を明示" },
  { id: "hkd", name: "国土交通省 北海道開発局", termsUrl: "https://www.hkd.mlit.go.jp/ky/ki/kouhou/ud49g7000000omnw.html", checkedOn: "2026-10-08", license: "PDL1.0", linkTarget: "top", note: "個別ページへのリンクは事前連絡が必要" },
  { id: "hrr", name: "国土交通省 北陸地方整備局", termsUrl: "https://www.hrr.mlit.go.jp/help.html", checkedOn: "2026-10-08", license: "PDL1.0", linkTarget: "page", notifyOnLink: true },
  { id: "hokkaido", name: "北海道", termsUrl: "https://www.pref.hokkaido.lg.jp/site-info/sitepolicy.html", checkedOn: "2026-10-08", license: "CC BY", linkTarget: "top", note: "トップページ以外へのリンクは各ページの管理者に問い合わせ" },
  { id: "aomori", name: "青森県", termsUrl: "https://www.pref.aomori.lg.jp/contents/copyright.html", checkedOn: "2026-10-08", linkTarget: "page-not-pdf", note: "リンクは営利・非営利を問わず原則自由。最初に読むべきページを飛ばす直接リンクは避ける" },
  { id: "iwate", name: "岩手県", termsUrl: "https://www.pref.iwate.jp/about/link.html", checkedOn: "2026-10-08", linkTarget: "top", note: "トップページへのリンクのみ記載あり" },
  { id: "miyagi", name: "宮城県", termsUrl: "https://www.pref.miyagi.jp/soshiki/kohou/site-riyou.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true, note: "トップページ以外へのリンクは担当課に問い合わせ" },
  { id: "akita", name: "秋田県", termsUrl: "https://www.pref.akita.lg.jp/pages/about-copyright", checkedOn: "2026-10-08", linkTarget: "top", note: "トップページへのリンクのみ記載あり" },
  { id: "yamagata", name: "山形県", termsUrl: "https://www.pref.yamagata.jp/kensei/shoukai/aboutthissite/mensekijikou.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "fukushima", name: "福島県", termsUrl: "https://www.pref.fukushima.lg.jp/sec/01010d/koho-chosakuken.html", checkedOn: "2026-10-08", linkTarget: "page", note: "リンク元URLの連絡は推奨" },
  { id: "tochigi", name: "栃木県", termsUrl: "https://www.pref.tochigi.lg.jp/kensei/kouhou/hp/chosakuken/index.html", checkedOn: "2026-10-08", linkTarget: "page-not-pdf" },
  { id: "gunma", name: "群馬県", termsUrl: "https://www.pref.gunma.jp/page/15257.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "niigata", name: "新潟県", termsUrl: "https://www.pref.niigata.lg.jp/site/userguide/chosakuken.html", checkedOn: "2026-10-08", linkTarget: "top", note: "その他のページへのリンクは事前に各ページの問い合わせ先へメール" },
  { id: "nagano", name: "長野県", termsUrl: "https://www.pref.nagano.lg.jp/koho/kensei/koho/homepage/link.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true, note: "トップページ以外へのリンクは担当課に問い合わせ" },
  { id: "yamanashi", name: "山梨県", termsUrl: "https://www.pref.yamanashi.jp/info/howto_site.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "gifu", name: "岐阜県", termsUrl: "https://www.pref.gifu.lg.jp/page/79328.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "shizuoka", name: "静岡県", termsUrl: "https://www.pref.shizuoka.jp/about/link.html", checkedOn: "2026-10-08", linkTarget: "page", notifyOnLink: true, note: "リンク元・リンク先のURLを連絡" },
  { id: "toyama", name: "富山県", termsUrl: "https://www.pref.toyama.jp/1021/kensei/kouhou/0.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "ishikawa", name: "石川県", termsUrl: "https://www.pref.ishikawa.lg.jp/about_site/sitepolicy/index.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true },
  { id: "fukui", name: "福井県", termsUrl: "https://www.pref.fukui.lg.jp/doc/dx-suishin/intro.html", checkedOn: "2026-10-08", linkTarget: "top", note: "各課のページへのリンクは各課に問い合わせ" },
  { id: "mie", name: "三重県", termsUrl: "https://www.pref.mie.lg.jp/info/chosaku.htm", checkedOn: "2026-10-08", linkTarget: "page", note: "リンク元URLの連絡は推奨" },
  { id: "shiga", name: "滋賀県", termsUrl: "https://www.pref.shiga.lg.jp/ab00/9916.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "kyoto", name: "京都府", termsUrl: "https://www.pref.kyoto.jp/copyright.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "hyogo", name: "兵庫県", termsUrl: "https://web.pref.hyogo.lg.jp/about_link.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "nara", name: "奈良県", termsUrl: "https://www.pref.nara.jp/1375.htm", linkTarget: "top", note: "サーバー証明書の期限切れで原文を開けず未確認(2026-10-08)" },
  { id: "tottori", name: "鳥取県", termsUrl: "https://www.pref.tottori.lg.jp/9314.htm", checkedOn: "2026-10-08", linkTarget: "top", note: "リンク条件は https://www.pref.tottori.lg.jp/dd.aspx?menuid=9320。トップページ以外は担当所属に問い合わせ" },
  { id: "shimane", name: "島根県", termsUrl: "https://www.pref.shimane.lg.jp/cl.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "okayama", name: "岡山県", termsUrl: "https://www.pref.okayama.jp/page/detail-4318.html", checkedOn: "2026-10-08", license: "PDL1.0", linkTarget: "page" },
  { id: "hiroshima", name: "広島県", termsUrl: "https://www.pref.hiroshima.lg.jp/soshiki/19/1173052529569.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true, note: "リンク先は原則トップページ" },
  { id: "ehime", name: "愛媛県", termsUrl: "https://www.pref.ehime.jp/page/14959.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "kochi", name: "高知県", termsUrl: "https://www.pref.kochi.lg.jp/reference/policy.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true },
  { id: "ino-town", name: "高知県いの町", termsUrl: "", linkTarget: "top", note: "UFOライン(町道瓶ヶ森線)の管理者。規約未確認" },
];

export interface TogeSource {
  id: string;
  publisherId: string;
  office: string; // 発表の単位(建設事務所・土木事務所など)
  url?: string; // 未設定は発表ページが未特定
  format: "html" | "pdf" | "system"; // system は県・国の道路情報システム(随時更新の画面)
  update: string;
  note?: string;
}

// 2026-10-08時点で発表ページを特定できたもの。事務所単位の残り(合計100ページ超の見込み)は今後追加する
export const SOURCES: TogeSource[] = [
  { id: "hkd-road", publisherId: "hkd", office: "北海道開発局(各開発建設部)", url: "https://info-road.hdb.hkd.mlit.go.jp/", format: "system", update: "随時。開通・閉鎖は各開発建設部の記者発表PDF" },
  { id: "hokkaido-doudou", publisherId: "hokkaido", office: "各建設管理部(道道)", format: "pdf", update: "未確認", note: "発表ページ未特定" },
  { id: "aomori", publisherId: "aomori", office: "県土整備部道路課", url: "https://www.pref.aomori.lg.jp/soshiki/kendo/doro/toukiheisasiryou.html", format: "pdf", update: "冬期閉鎖資料と閉鎖解除資料を年度別に掲載" },
  { id: "iwate-douro", publisherId: "iwate", office: "岩手県道路情報提供サービス", url: "https://www.douro.com/closure.shtml", format: "system", update: "閉鎖期間・解除予定を随時更新", note: "Shift_JISで要約できず、運営者とサイト独自の規約は未確認" },
  { id: "miyagi", publisherId: "miyagi", office: "土木部道路課", url: "https://www.pref.miyagi.jp/soshiki/road/winterstop.html", format: "html", update: "冬期閉鎖区間の案内。最新はJARTIC・県の総合情報システムへ誘導" },
  { id: "akita", publisherId: "akita", office: "各地域振興局", format: "pdf", update: "日付つきPDFを出し直す(春は頻繁)", note: "PDFの置き場 pref.akita.lg.jp/uploads/public/archive_0000068677_00/ は判明。掲載ページは未特定" },
  { id: "yamagata", publisherId: "yamagata", office: "各総合支庁", format: "pdf", update: "道路ごとの閉鎖・解除の記者発表PDF", note: "一覧ページ未特定" },
  { id: "fukushima", publisherId: "fukushima", office: "各建設事務所", format: "pdf", update: "道路ごとの記者発表PDF", note: "一覧ページ未特定" },
  { id: "tochigi", publisherId: "tochigi", office: "各土木事務所", format: "pdf", update: "冬期通行止め一覧PDF・ページ", note: "一覧ページ未特定" },
  { id: "gunma", publisherId: "gunma", office: "県土整備部道路管理課", url: "https://www.pref.gunma.jp/page/11074.html", format: "html", update: "本文16区間+PDF。年度ごとに更新" },
  { id: "niigata-yoita", publisherId: "niigata", office: "長岡地域振興局 与板維持管理事務所", url: "https://www.pref.niigata.lg.jp/site/nagaoka-seibi-yoita/road-closed-in-winter.html", format: "html", update: "地域振興局ごとのページ", note: "他の地域振興局は未特定" },
  { id: "nagano-suzaka", publisherId: "nagano", office: "須坂建設事務所", url: "https://www.pref.nagano.lg.jp/suzakaken/doro/heisa.html", format: "html", update: "解除済みも追記", note: "他の建設事務所は未特定" },
  { id: "yamanashi", publisherId: "yamanashi", office: "県土整備部", format: "pdf", update: "冬期閉鎖PDF", note: "掲載ページ未特定" },
  { id: "gifu", publisherId: "gifu", office: "県土整備部(土木事務所ごと)", url: "https://www.pref.gifu.lg.jp/page/61451.html", format: "pdf", update: "土木事務所ごとの冬期閉鎖・解除一覧PDF" },
  { id: "toyama", publisherId: "toyama", office: "土木部道路課", url: "https://www.pref.toyama.jp/1501/kendodukuri/dourokouwan/douro/kj00014191.html", format: "html", update: "地域別の表。冬期通行止め・災害・工事を併記(2026-09-15更新)" },
  { id: "ishikawa", publisherId: "ishikawa", office: "土木部道路整備課", format: "pdf", update: "白山公園線などの記者発表PDF(例: /kisya/r7/documents/0514_10_douroseibi.pdf)", note: "記者発表一覧ページから探す" },
  { id: "fukui-okuetsu", publisherId: "fukui", office: "奥越土木事務所", url: "https://www.pref.fukui.lg.jp/doc/okuetu-doboku/index.html", format: "html", update: "新着情報に路線ごとの通行止めのお知らせ(本文)", note: "他の土木事務所は未確認" },
  { id: "shizuoka-fuji", publisherId: "shizuoka", office: "富士土木事務所ほか", url: "https://www.pref.shizuoka.jp/machizukuri/doro/fujisandoro/1029307.html", format: "html", update: "富士山五合目への県道3ルートの閉鎖・解除(例年4月下旬解除)" },
  { id: "mie-r477", publisherId: "mie", office: "四日市建設事務所", url: "https://www.pref.mie.lg.jp/TOPICS/m0038500150.htm", format: "html", update: "国道477号(旧鈴鹿スカイライン)。シーズンごとに新しいお知らせページを作る", note: "見張りは同事務所のお知らせ一覧から行う" },
  { id: "nara", publisherId: "nara", office: "県土マネジメント部", url: "https://www.pref.nara.jp/secure/316755/happyou.pdf", format: "pdf", update: "年度ごとの冬季通行止めの発表PDF" },
  { id: "tottori", publisherId: "tottori", office: "県土整備部", url: "https://www.pref.tottori.lg.jp/277129.htm", format: "pdf", update: "日付つきの冬期閉鎖PDF" },
  { id: "ehime-ishizuchi", publisherId: "ehime", office: "久万高原土木事務所", url: "https://www.pref.ehime.jp/page/1209.html", format: "html", update: "石鎚スカイライン。12/1〜3/31の固定期間(ページ更新は2021-04-01)" },
  { id: "kyoto-system", publisherId: "kyoto", office: "京都府道路情報管理・提供システム", url: "https://dobokubousai.pref.kyoto.jp/sp/", format: "system", update: "随時", note: "冬期閉鎖の一覧ページは見つからず" },
  { id: "hiroshima-system", publisherId: "hiroshima", office: "ひろしま道路ナビ", url: "http://www.roadnavi.pref.hiroshima.lg.jp/", format: "system", update: "随時", note: "冬期閉鎖の一覧ページは見つからず" },
  { id: "shimane-system", publisherId: "shimane", office: "島根県道路規制情報", url: "https://info.bousai-shimane.jp/RoadShimane/", format: "system", update: "随時", note: "冬期閉鎖の一覧ページは見つからず" },
];
