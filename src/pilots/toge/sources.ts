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
  { id: "nara", name: "奈良県", termsUrl: "https://www.pref.nara.lg.jp/link.html", checkedOn: "2026-10-08", linkTarget: "top", note: "リンクはトップページへ張るよう求めている。旧ドメイン pref.nara.jp は証明書切れ" },
  { id: "tottori", name: "鳥取県", termsUrl: "https://www.pref.tottori.lg.jp/9314.htm", checkedOn: "2026-10-08", linkTarget: "top", note: "リンク条件は https://www.pref.tottori.lg.jp/dd.aspx?menuid=9320。トップページ以外は担当所属に問い合わせ" },
  { id: "shimane", name: "島根県", termsUrl: "https://www.pref.shimane.lg.jp/cl.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "okayama", name: "岡山県", termsUrl: "https://www.pref.okayama.jp/page/detail-4318.html", checkedOn: "2026-10-08", license: "PDL1.0", linkTarget: "page" },
  { id: "hiroshima", name: "広島県", termsUrl: "https://www.pref.hiroshima.lg.jp/soshiki/19/1173052529569.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true, note: "リンク先は原則トップページ" },
  { id: "ehime", name: "愛媛県", termsUrl: "https://www.pref.ehime.jp/page/14959.html", checkedOn: "2026-10-08", linkTarget: "page" },
  { id: "kochi", name: "高知県", termsUrl: "https://www.pref.kochi.lg.jp/reference/policy.html", checkedOn: "2026-10-08", linkTarget: "top", notifyOnLink: true },
  { id: "ino-town", name: "高知県いの町", termsUrl: "", linkTarget: "top", note: "UFOライン(町道瓶ヶ森線)の管理者。サイトポリシーのページが見つからず規約未確認。通行情報は https://www.town.ino.kochi.jp/shigoto/kanko/10060/ (PDF・Instagram・Facebookへ誘導)" },
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
  { id: "hokkaido-sapporo", publisherId: "hokkaido", office: "札幌建設管理部", url: "https://www.sorachi.pref.hokkaido.lg.jp/kk/skk/kanri/0210touki.html", format: "pdf", update: "年度ごとの冬期通行止一覧PDF(R8-R9版を2026-09-18に掲載)", note: "PDFのファイル名に年度が入る" },
  { id: "hokkaido-hakodate", publisherId: "hokkaido", office: "函館建設管理部", url: "https://www.oshima.pref.hokkaido.lg.jp/kk/hkk/toukituukoukisei.html", format: "html", update: "年度ごとの冬期通行止め区間一覧PDF(R7版、2025-11-19更新)", note: "PDFのファイル名に年度が入る" },
  { id: "hokkaido-otaru", publisherId: "hokkaido", office: "小樽建設管理部", url: "https://www.shiribeshi.pref.hokkaido.lg.jp/kk/okk/a0003/b0002/", format: "pdf", update: "冬期通行規制情報の案内ページ", note: "一覧の個別ページ(KR/202777.html)は404。PDFの場所は未特定" },
  { id: "hokkaido-muroran", publisherId: "hokkaido", office: "室蘭建設管理部", url: "https://www.iburi.pref.hokkaido.lg.jp/kk/mkk/122121.html", format: "pdf", update: "年度ごとの冬期通行止め路線一覧PDF(R7版、2025-10-21更新)", note: "PDFのファイル名に年度が入る" },
  { id: "hokkaido-asahikawa", publisherId: "hokkaido", office: "旭川建設管理部", url: "https://www.kamikawa.pref.hokkaido.lg.jp/kk/akk/87945.html", format: "pdf", update: "年度ごとの冬期通行規制一覧PDF(令和8年度版を掲載済み)" },
  { id: "hokkaido-rumoi", publisherId: "hokkaido", office: "留萌建設管理部", url: "https://www.rumoi.pref.hokkaido.lg.jp/kk/rkk/oshirase-toukikisei.html", format: "pdf", update: "年度ごとの通行止箇所PDF(R7冬期、2026-03-25更新)", note: "PDFのファイル名に年度が入る" },
  { id: "hokkaido-wakkanai", publisherId: "hokkaido", office: "稚内建設管理部", url: "https://www.souya.pref.hokkaido.lg.jp/kk/wkk/douro/R1toukituukodome.html", format: "html", update: "路線・区間・距離・期間(解除予定日時つき)の表。11区間(2026-05-08更新)" },
  { id: "hokkaido-obihiro", publisherId: "hokkaido", office: "帯広建設管理部", url: "https://www.tokachi.pref.hokkaido.lg.jp/kk/okk/a0005/", format: "html", update: "道道の通行規制の案内ページ", note: "冬期通行止めの一覧はなく、規制情報は別ページ・北海道地区道路情報へ誘導" },
  { id: "hokkaido-kushiro", publisherId: "hokkaido", office: "釧路建設管理部(釧路・根室管内)", url: "https://www.kushiro.pref.hokkaido.lg.jp/kk/kkk/kanrika/toukikou.html", format: "html", update: "路線・期間・解除予定日の表。10区間、解除は4/3〜6/5(2026-08-10更新)" },
  { id: "hokkaido-abashiri", publisherId: "hokkaido", office: "網走建設管理部", format: "system", update: "北海道地区道路情報へ誘導", note: "独自の一覧ページは未特定" },
  { id: "aomori", publisherId: "aomori", office: "県土整備部道路課", url: "https://www.pref.aomori.lg.jp/soshiki/kendo/doro/toukiheisasiryou.html", format: "pdf", update: "冬期閉鎖資料と閉鎖解除資料を年度別に掲載" },
  { id: "iwate-douro", publisherId: "iwate", office: "岩手県道路情報提供サービス", url: "https://www.douro.com/closure.shtml", format: "system", update: "閉鎖期間・解除予定を随時更新", note: "Shift_JISで要約できず、運営者とサイト独自の規約は未確認" },
  { id: "miyagi", publisherId: "miyagi", office: "土木部道路課", url: "https://www.pref.miyagi.jp/soshiki/road/winterstop.html", format: "html", update: "冬期閉鎖区間の案内。最新はJARTIC・県の総合情報システムへ誘導" },
  { id: "akita-michi", publisherId: "akita", office: "あきたのみち情報(県全体)", url: "http://road.pref.akita.lg.jp/", format: "pdf", update: "県全体の冬期閉鎖路線調書PDFを日付つきで出し直す(例: /html/10touki_stop/■R6-R7冬期閉鎖区間(R7.4.18現在).pdf)", note: "httpのみでWebFetchでは開けず。ファイル名が更新ごとに変わるため一覧ページから辿る" },
  { id: "akita-senboku", publisherId: "akita", office: "仙北地域振興局", url: "https://www.pref.akita.lg.jp/pages/archive/68718", format: "html", update: "年度ごとの冬期通行規制区間一覧PDF(R7-R8)と国道341号玉川の案内PDF" },
  { id: "yamagata-doro", publisherId: "yamagata", office: "山形県の通行規制情報(県全体)", url: "https://www.pref.yamagata.jp/doro/", format: "system", update: "規制区分「冬期閉鎖」で県全体を表で表示。時点を明記(2026-10-08 15:00時点で0件)" },
  { id: "yamagata-press", publisherId: "yamagata", office: "各総合支庁(記者発表)", url: "https://www.pref.yamagata.jp/314001/kensei/joho/koho/houdouhappyou/2026/4gatsu/r80424-7.html", format: "html", update: "毎年4月に解除予定を記者発表(最上総合支庁、2026-04-24)。本文は告知のみで中身はPDF", note: "他の総合支庁も同形式と見られる。開通予定日はこちらから取る" },
  { id: "fukushima-kisei", publisherId: "fukushima", office: "福島県道路通行規制情報(県全体)", url: "http://www.pref.fukushima.jp/douro/kisei/kisei-list.htm", format: "system", update: "規制区分「冬期通行止」を含む県全体の一覧", note: "https化で証明書が合わず開けず。lg.jpドメインでは404" },
  { id: "fukushima-tadami", publisherId: "fukushima", office: "南会津建設事務所 山口土木事務所", url: "https://www.pref.fukushima.lg.jp/sec/41361a/road.html", format: "html", update: "路線・区間・期間・備考の表(15件、2026-06-09更新)" },
  { id: "fukushima-wakamatsu", publisherId: "fukushima", office: "会津若松建設事務所", url: "https://www.pref.fukushima.lg.jp/sec/41340a/wakamatsukensetsu-koutuukisei.html", format: "pdf", update: "本文+PDF(記者発表・一覧表・区間図)。国道401号ほか3路線、解除予定日時つき(2026-04-23更新)" },
  { id: "fukushima-kanko", publisherId: "fukushima", office: "道路管理課(観光道路)", url: "https://www.pref.fukushima.lg.jp/sec/41035c/20221021-kankoudouro.html", format: "html", update: "観光道路4路線(磐梯吾妻スカイライン等)の冬期通行止めPDF", note: "ページ更新は2022-10-21。毎年のPDF差し替えか要確認" },
  { id: "tochigi-zenmen", publisherId: "tochigi", office: "道路保全課(県全体)", url: "https://www.pref.tochigi.lg.jp/h05/dourohozentuukoutome.html", format: "html", update: "県管理道路の全面通行止め(災害・工事)と土木事務所ページへの案内(2026-03-31更新)", note: "冬期通行止めの一覧は載っていない" },
  { id: "tochigi-nikko", publisherId: "tochigi", office: "日光土木事務所", url: "https://www.pref.tochigi.lg.jp/h53/kiseikukan.html", format: "html", update: "本文+PDF。5路線(金精道路・中宮祠足尾線など)。年度版PDF(令和7年度版)", note: "開通予定日の記載なし(「期間が前後する場合あり」のみ)" },
  { id: "tochigi-h56", publisherId: "tochigi", office: "土木事務所(h56)", url: "https://www.pref.tochigi.lg.jp/h56/toukituukoudomekukukan.html", format: "html", update: "矢板土木事務所。塩原矢板線1件、毎年12月上旬〜3月下旬の目安のみ(2024-11-28更新)", note: "開通予定日の記載なし" },
  { id: "gunma", publisherId: "gunma", office: "県土整備部道路管理課", url: "https://www.pref.gunma.jp/page/11074.html", format: "html", update: "本文16区間+PDF。年度ごとに更新" },
  { id: "niigata-kotukisei", publisherId: "niigata", office: "通行規制情報(県全体)", url: "http://www.niigata-kotukisei.jp/", format: "system", update: "下越・佐渡/中越/上越の地域別リンク", note: "新潟県土木部の運営(著作権表示のみで独自規約なし)。トップに冬期閉鎖の表示はない" },
  { id: "niigata-yoita", publisherId: "niigata", office: "長岡地域振興局 与板維持管理事務所", url: "https://www.pref.niigata.lg.jp/site/nagaoka-seibi-yoita/road-closed-in-winter.html", format: "html", update: "地域振興局ごとのページ" },
  { id: "niigata-shibata", publisherId: "niigata", office: "新発田地域振興局", url: "https://www.pref.niigata.lg.jp/site/winter-road/", format: "html", update: "新発田地域の冬期道路情報(2023-10-31更新)", note: "冬期閉鎖の一覧はなし" },
  { id: "niigata-joetsu", publisherId: "niigata", office: "上越地域振興局", url: "https://www.pref.niigata.lg.jp/site/jouetsu-seibi/1217354468498.html", format: "html", update: "冬期交通不能区間の規制状況表。解除に合わせて順次更新(2026-06-10更新)", note: "表は画像のため文字で取れない。読み取り方法を設計時に決める" },
  { id: "niigata-tokamachi", publisherId: "niigata", office: "十日町地域振興局", url: "https://www.pref.niigata.lg.jp/site/tokamachi-seibi/1356921688932.html", format: "html", update: "冬期閉鎖の状況一覧PDFと位置図PDF。開始・解除日つき(2026-06-17更新)" },
  { id: "niigata-itoigawa", publisherId: "niigata", office: "糸魚川地域振興局", url: "https://www.pref.niigata.lg.jp/site/itoigawa-seibi/toukitsukoutome.html", format: "html", update: "路線・区間・延長・解除予定日時の表。6区間(2026-04-30更新)", note: "ページ名に年度が入る" },
  { id: "niigata-uonuma", publisherId: "niigata", office: "魚沼地域振興局", url: "https://www.pref.niigata.lg.jp/site/uonuma-seibi/dourojouhou.html", format: "html", update: "国道252号・352号・奥只見シルバーラインごとに個別ページへ案内。X(旧Twitter)でも発信", note: "開通予定日は個別ページから取る" },
  { id: "nagano-suzaka", publisherId: "nagano", office: "須坂建設事務所", url: "https://www.pref.nagano.lg.jp/suzakaken/doro/heisa.html", format: "html", update: "解除済みも追記" },
  { id: "nagano-nagano", publisherId: "nagano", office: "長野建設事務所", url: "https://www.pref.nagano.lg.jp/choken/doro/doro/toki.html", format: "html", update: "路線・区間・距離・開始/解除日時・備考の表。5件、解除済みを追記(2026-04-10更新)" },
  { id: "nagano-saku", publisherId: "nagano", office: "佐久建設事務所", url: "https://www.pref.nagano.lg.jp/sakuken/doro/doroinfo/r7toukitsuukoudome_kaijyo.html", format: "html", update: "年度ごとの解除のお知らせ。7件、解除日時つき(十石峠・馬越峠など、2026-03-13更新)", note: "URLが年度で変わる(冬期通行止め一覧は /sakuken/doro/doroinfo/r6toukitsuukoudome.html)" },
  { id: "nagano-omachi", publisherId: "nagano", office: "大町建設事務所", format: "pdf", update: "冬期閉鎖PDF(例: /omachiken/documents/tokiheisa2022.pdf)", note: "掲載ページ未特定" },
  { id: "yamanashi-kisei", publisherId: "yamanashi", office: "山梨県道路規制情報(県全体)", url: "https://www.pref.yamanashi.jp/dourokisei/", format: "system", update: "規制区分「冬期閉鎖」で県全体を一覧。RSSあり", note: "画面は読み込み式。RSSのURLは未確認" },
  { id: "yamanashi-kyoto", publisherId: "yamanashi", office: "峡東建設事務所", url: "https://www.pref.yamanashi.jp/kt-kensetsu/douroka.html", format: "html", update: "路線と閉鎖期間(解除予定日時つき)の表。4路線。決定次第更新" },
  { id: "gifu", publisherId: "gifu", office: "県土整備部(土木事務所ごと)", url: "https://www.pref.gifu.lg.jp/page/61451.html", format: "pdf", update: "土木事務所ごとの冬期閉鎖・解除一覧PDF" },
  { id: "toyama", publisherId: "toyama", office: "土木部道路課", url: "https://www.pref.toyama.jp/1501/kendodukuri/dourokouwan/douro/kj00014191.html", format: "html", update: "地域別の表。冬期通行止め・災害・工事を併記(2026-09-15更新)" },
  { id: "ishikawa", publisherId: "ishikawa", office: "土木部道路整備課", format: "pdf", update: "白山公園線などの記者発表PDF(例: /kisya/r7/documents/0514_10_douroseibi.pdf)", note: "記者発表一覧ページから探す" },
  { id: "fukui-okuetsu", publisherId: "fukui", office: "奥越土木事務所", url: "https://www.pref.fukui.lg.jp/doc/okuetu-doboku/index.html", format: "html", update: "新着情報に路線ごとの通行止めのお知らせ(本文)", note: "他の土木事務所は未確認" },
  { id: "shizuoka-fuji", publisherId: "shizuoka", office: "富士土木事務所ほか", url: "https://www.pref.shizuoka.jp/machizukuri/doro/fujisandoro/1029307.html", format: "html", update: "富士山五合目への県道3ルートの閉鎖・解除(例年4月下旬解除)" },
  { id: "mie-r477", publisherId: "mie", office: "四日市建設事務所", url: "https://www.pref.mie.lg.jp/TOPICS/m0038500150.htm", format: "html", update: "国道477号(旧鈴鹿スカイライン)。シーズンごとに新しいお知らせページを作る", note: "見張りは同事務所のお知らせ一覧から行う" },
  { id: "nara", publisherId: "nara", office: "道路マネジメント課", url: "https://www.pref.nara.lg.jp/n136/70595.html", format: "pdf", update: "年度ごとの「奈良県内 冬季通行止について」。本文は告知のみで路線・期間は報道発表PDFと位置図PDF(令和7年度版、2026-02-27更新)。課の担当ページ一覧 /n136/ichiran.html から辿る", note: "大台ヶ原公園川上線は12/1〜4/20" },
  { id: "tottori", publisherId: "tottori", office: "県土整備部", url: "https://www.pref.tottori.lg.jp/277129.htm", format: "pdf", update: "日付つきの冬期閉鎖PDF" },
  { id: "ehime-ishizuchi", publisherId: "ehime", office: "久万高原土木事務所", url: "https://www.pref.ehime.jp/page/1209.html", format: "html", update: "石鎚スカイライン。12/1〜3/31の固定期間(ページ更新は2021-04-01)" },
  { id: "kyoto-system", publisherId: "kyoto", office: "京都府道路情報管理・提供システム", url: "https://dobokubousai.pref.kyoto.jp/sp/", format: "system", update: "随時", note: "冬期閉鎖の一覧ページは見つからず" },
  { id: "hiroshima-system", publisherId: "hiroshima", office: "ひろしま道路ナビ", url: "http://www.roadnavi.pref.hiroshima.lg.jp/", format: "system", update: "随時", note: "冬期閉鎖の一覧ページは見つからず" },
  { id: "shimane-system", publisherId: "shimane", office: "島根県道路規制情報", url: "https://info.bousai-shimane.jp/RoadShimane/", format: "system", update: "随時", note: "冬期閉鎖の一覧ページは見つからず" },
];
