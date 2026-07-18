# HANDOFF

最終更新: 2026-07-18

## 今回変更したこと(何を・なぜ)

### テーマH: X(公式API)キーワード監視の実装準備(APIキー未設定・動作待機状態)
Tier2最終評議会(2026-07-18)でXを狭域キーワード限定のアラート型として採用、キーワードセットも
6語の仮運用リストとして裁定された。今回はコード・設定の実装準備のみ(実キー取得・実ポーリング
開始・VM反映はスコープ外、オーナー専決事項として明確に切り分け)。

- `config/xKeywords.json`: 仮運用6語("SaaS 値上げ"→A、"保険料 値上げ"→E、"micro saas"→H、
  "indie hacker"→H、"build in public"→F/H、"SaaS 障害"→C)+対応テーマ+仮運用期間(2026-07-18
  起点14日)をハードコードせず管理
- `src/lib/xApi.ts`: X API v2 Recent search(`https://api.x.com/2/tweets/search/recent`)の
  薄いクライアント。認証はBearer Tokenを環境変数からのみ読む(コード内にキーは置かない)。
  `query`/`max_results`/`since_id`/`tweet.fields=created_at,author_id`に対応
- `src/adapters/xKeywords.ts`: ポーリング本体(`npm run x:poll`で実行可能)。設計判断は以下の通り:
  - **Source/Snapshot/Changeへの接続方針**: 専用テーブルは新設せず、既存モデルにそのまま
    乗せる設計とした。1キーワード=1Source行(`companyName`は`X検索: "<keyword>"`形式、
    `insuranceType="theme_h"`、`fetchType="x_search"`)とし、取得結果(ツイート配列)をJSON化
    して既存の`saveRawSnapshot`でgzip保存、`Snapshot`+(新規ツイートがあれば)`Change`を作成する
    フローは既存のcrawler.tsと同型。ただし**汎用crawler.ts(`fetchByType`)には`x_search`ケースを
    意図的に追加していない**。理由は、X APIが`since_id`(直近取得済みIDを起点に増分取得)と
    Bearer認証ヘッダを必要とし、汎用crawlerの`fetchByType(fetchType, url)`という2引数シグネチャ
    では前回スナップショットの内容(直近ツイートID)にアクセスできず素直に載せられないため。
    このため本体は`src/adapters/statuspage.ts`と同様の「独立した専用スクリプト」として実装し、
    別建てのcron(1日3〜5回、今回は未設定)から起動する想定とした。仮に将来`fetchType="x_search"`の
    Source行が誤って`active=true`のまま汎用スケジューラに巡回されても、`fetchByType`の
    default caseが`unsupported_fetch_type`エラーを返すだけで安全(既存のpuppeteer未実装ソースと
    同じフェイルセーフ)
  - **ポーリング設計**: 1回あたり`max_results=20`固定(評議会裁定通り)。`since_id`は直近
    Snapshotのraw(gz)を読み直してツイートID群の最大値を都度算出する方式とし、状態を保持する
    専用ファイル/テーブルを追加していない(`src/council/extractCandidates.ts`が採用している
    「rawスナップショットを読み直して状態を導出する」既存パターンを踏襲)
  - **Spending limit相当の安全装置**: (1)1回のスクリプト実行あたりのAPI呼び出し数上限
    (`X_MAX_CALLS_PER_RUN`、既定はキーワード数=6でバグによる暴走を防止)、(2)月間の累計取得件数
    ソフトキャップ(`X_MONTHLY_POST_CAP`、任意設定。当月分Snapshotのraw実績を都度集計するため
    別テーブル不要)の2段構え。いずれも未設定なら安全側のデフォルト(呼び出し数=6、月間上限なし)
    で動作
  - **APIキー未設定時の挙動**: `X_BEARER_TOKEN`が空の場合は起動直後に全キーワードを
    `no_bearer_token`としてスキップし、ネットワークアクセス・DB書き込みとも一切発生しない
    ことを実行して確認済み。またSource行が未登録の状態でダミートークンを設定して実行しても、
    `skipped_no_source`として同様に安全にスキップされ、API呼び出しは発生しないことも確認済み
  - `package.json`に`x:poll`スクリプトを追加(`tsx src/adapters/xKeywords.ts`)。新規npm
    パッケージは追加していない(標準`fetch`のみで実装)
  - `.env`に`X_BEARER_TOKEN`のプレースホルダ行(値は空)を追記済み(既存の値は読まず末尾追記のみ)
- **sources未登録**: 本タスクにはDB反映方針の指定がなく、実APIキーがないと動作確認もできない
  ため、6キーワード分のSource行は今回登録していない。オーナーがAPIキーを取得しactive化する際は、
  `companyName`を`src/adapters/xKeywords.ts`の`companyNameFor(keyword)`が返す形式
  (`X検索: "<keyword>"`)に合わせて`insuranceType="theme_h"`・`fetchType="x_search"`で
  追記専用createManyすればそのままポーリング対象になる設計
- **オーナーがAPIキー設定後に行う手順(簡潔版)**:
  1. X Developer ConsoleでBearer Tokenを取得し、`.env`の`X_BEARER_TOKEN=`に設定
  2. 上記の`companyNameFor`形式で6件のSource行をcreateMany登録(active=trueで登録してよい。
     汎用crawler.tsには`x_search`が無いため巡回されず無害)
  3. `npm run x:poll`を手動実行し、`ok`/`skipped_*`/`error`のサマリログで疎通確認
  4. 問題なければ、別建てのcron(1日3〜5回、例: `0 */5 * * *`相当)に`npm run x:poll`を登録
     (今回は未設定。既存`src/scheduler.ts`の毎分tick方式とは別立てにすること)

### テーマH: App Store公式RSS(トレンド軸)を調査・登録
Tier2最終評議会(2026-07-18)でApp Store公式RSSをTier1格上げ採用と裁定されたことを受けた調査。
依頼時の候補URL(`itunes.apple.com/{jp,us}/rss/{newapplications,topfreeapplications}/...`)は
robots.txtが`User-agent: *`に対し`Disallow: /*/rss/*`を明示しており、本番`politeFetch`でも
4件とも`disallowed_by_robots_txt`で遮断されることを確認した(この旧エンドポイント自体、Apple
側で既に非推奨)。Apple公式の後継API(`rss.marketingtools.apple.com/api/v2/...`、robots.txtは
コメントのみで実質無制限)に切替えて再検証したところ、`top-free`(トップ無料)は本番
`politeFetch`でJP/US双方200・JSON・50件を確認できたが、「新着」に相当するチャート種別
(`new-apps-we-love`等を試行したが404)は後継APIに存在しないことが判明。オーナーに報告の上、
「本ソースの目的は急上昇=トレンド把握であり新着はその手段の一つに過ぎない、top-paid追加も
目的への寄与が薄いため見送り」との判断を得て、`top-free`のJP/US 2件のみをactive登録した
(新着相当は代替不可のためsources未登録、本記録のみに留める)。fetch_typeは既存の`"json"`
(`src/fetchers/json.ts`)でそのまま対応可能なため新規fetch_type追加は不要だった

### テーマH: Indie Hackersを実地再調査しactive登録
生需要軸強化の一環。前回(2026-07-18初回調査)は`/starting-up`ページを対象に本番`politeFetch`で
実地fetchし、本文がFirebase設定のJSON blobのみでSSR見出しゼロ件だったためJS SPAと判断し
sources未登録(バックログ)としていた。今回、対象URLをホーム(`https://www.indiehackers.com/`)
に変更して同じく本番`politeFetch`で再検証したところ、200・本文313KB・`h1`-`h3`見出し56件
(実際の投稿タイトル)がSSRされていることを確認できたため、方針を変更してactive登録した
(`/starting-up`は引き続きJS SPAシェル(本文22KB・見出し0件)であることも同時に再確認済み)。
robots.txt自体はWebFetchツールから403で取得できなかったが、`src/lib/robots.ts`の実装
(取得失敗時はbody空扱いで「制限なし」とみなす)に従い、本番`isAllowedByRobots()`では
`true`(許可)と判定されることをコードから実行して確認した。1件を`theme_h`でactive登録
(ローカルdev.dbのみ、既存103件は非削除)

### テーマH: 情報源拡張(供給観測軸/生需要軸/検証層)Tier1を調査・登録
評議会裁定によりHテーマの情報源を「供給観測軸(ローンチボード)/生需要軸(Reddit)」の2軸で
拡張する方針が確定したことを受け、無人収集できるTier1の4系統(Reddit・ローンチボード・
国内スタートアップメディア・Google Trends)を実地WebFetchで検証し登録した。

- **Reddit(生需要軸)4件**: r/SaaS・r/Entrepreneur・r/smallbusiness・r/sideprojectいずれも
  reddit.comのrobots.txtがUser-agent: *に対しDisallow: /(ドメイン全体禁止)。2026-07-18の
  テーマH初回調査時に本番`politeFetch`で実機確認済みのドメイン単位ブロックのため、今回は
  個別subreddit再検証を省略。WebFetchツールがreddit.comへの到達を拒否したためcurlでの
  再検証を提案したが、ユーザー判断により見送り。4件ともinactiveとして登録
- **ローンチボード(供給観測軸)4件**: BetaList・Fazier・SaaSHubはrobots.txtが実質無制限
  (BetaListはDisallow指定なし、Fazier/SaaSHubは個別ページ・特定ボットのみ制限)かつホームの
  静的HTML本文に新着一覧がSSRされていることを確認しactive登録(いずれもRSSフィードは無し、
  fetchType=html)。Uneedはrobots.txt自体は許可的だが、ホームHTML本文が「Loading...」のみで
  新着情報がJSで後付け読込されるSPAシェルだったためinactive
- **国内スタートアップメディア(一次情報)3件**: THE BRIDGEはrobots.txtがClaudeBot/GPTBot/
  CCBot/Google-Extended等を名指しでDisallow: /していたため、`CLAUDE.md`「巡回対象選定の
  追加ルール」(Canva調査時制定)によりinactive。Coral Capitalはrobots.txt全面許可+
  `/feed`が正常なRSS 2.0を返すためactive(fetchType=rss)。KEPPLEは当初提示された`kepple.co`
  がドメイン失効しGoDaddyの販売ページへリダイレクトすることが判明したため、WebSearchで
  正しい公式メディアURL(`kepple.co.jp`)を特定して調査し直した。robots.txt全面許可・ホーム
  SSRに記事一覧を含むためactive(RSSフィードは無し、fetchType=html)
- **Google Trends(検証層)2件**: JP/USとも`/trending/rss`はrobots.txtの制限対象外
  (Disallowは`/explore?`と`/trends/explore?`のみ)で、実地fetchでRSS 2.0(item10件)を確認。
  両方active。急上昇キーワードの裏取り用途のため、他H系ソース(日次前後)より短い巡回間隔
  (240分・251分)を設定
- プラットフォーム特定: 上記13件はいずれも独立系で、既存パーサを流用できる共通基盤
  (freee=Hund.ioのような)は見当たらなかった。KEPPLEのみsitemap命名(`server-sitemap/*`)から
  next-sitemap(Next.js)使用が推測される程度
- DB反映は`CLAUDE.md`のDB反映方針通り、`prisma/seed.ts`のdeleteMany→createMany全洗い替えは
  使わず、一時スクリプト(実行後削除)による`createMany`のみの追記で実施(ローカルdev.dbのみ、
  既存103-13=90件は非削除)。`prisma/seed.ts`にも同じ13件を新規ブロックとして追記し、
  cumulativeな参照ソースとしての整合性を維持
- 今回はローカル登録のみ。VM(161.33.148.155)への反映は次回まとめて実施する想定
  (ユーザー確認済み、下記「次アクション」参照)
- パーサー実装は今回のスコープ外(収集のみ)。新規レスポンス形式は無く、既存fetchType
  (html/rss)の範囲内で登録できた

### 自動評議会パイプライン(半自動スタート)を新規実装
テーマ量産構想②段階。テーマH(ヒント原料)の蓄積→評議会裁定→Slack通知→承認後の調査プロンプト
自動生成までを`src/council/`配下にスクリプト化。今回は「オーナーがチャットで指示して`npm run
council:run`を叩く」半自動運用とし、将来cronから直接呼び出せるよう、トリガー(CLIエントリ)と
ロジック(`runCouncilPipeline()`)を分離した。

- `extractCandidates.ts`: テーマHソース(Hacker News Show/Ask HN・Product Huntフィード・
  はてなブックマーク2件)のChangeレコードから直近7日分のrawスナップショット(gz)を読み、
  RSS/Atomはrss-parserで、HN(IDリストのみ差分検知)は新規IDのみ`item/<id>.json`を追加fetchして
  タイトルを補完。日本語(CJK含む)は文字2-3gram、英語は単語分割という新規ライブラリ不要の
  軽量頻度分析で候補5〜10件を抽出する。ローカルで実際に5ソースを巡回し、実データで動作確認済み
  (例: "agent"score20、"claude"score8等、意味のある候補が抽出できることを確認)
- **「急増」判定について**: H系ソースは登録直後で比較対象の過去データがないため、当面は単純頻度
  上位で代替。2週間程度データが貯まった時点で直近7日 vs その前7日の比率による急増判定に
  自動移行できる設計(閾値切替のみで実装済みロジックの変更は不要)
- `runCouncil.ts`: Claude Opus 4.8(`claude-opus-4-8`)+ 公式SDK(`@anthropic-ai/sdk`、今回追加した
  唯一の新規依存)。GOVERNANCE.md全文をシステムプロンプトに埋め込み、5役(市場戦略家/リスク管理官/
  ハーヴェスト理論の番人/地域リサーチャー/運用・財務担当)+監査役の2ラウンド評議を実施。
  「裁定項目に現有資産適合のような既存プロジェクト有利な項目を入れてはならない」という
  アンカリング防止の指示を明文で固定。web_searchツール(`web_search_20260209`)使用、
  サーバー側検索がpause_turnで一旦返るケースは自動再送で継続する実装済み。usageトークン数から
  概算コスト(円換算)を算出しログ・通知に含める
- `notify.ts`: mail-check-appのSlack通知パターン(素のhttps POST+リトライ)を踏襲し、
  Block Kitのカード形式に変更。監査役コメントを必ず含める
- `generatePrompt.ts`: 評議会裁定が「採択」のテーマについて、F/G/Hと同形式
  (背景と目的/スコープ/制約)の調査プロンプトMarkdownを自動生成し`council-output/{topic}.md`に
  保存するのみ。CCへの投入はオーナーが手動で行う(最終関門は人間が握る設計)
- 承認トリガーの方式について、Slack上でのボタン/絵文字リアクション等によるインタラクティブな
  承認検知は公開HTTPSエンドポイント・Slack App interactivity設定など追加インフラが必要なため
  今回は見送り、**評議会の裁定が「採択」のテーマは自動的にプロンプト生成まで行う**方式で確定
  (ユーザー承認済み)。生成後もCC投入は人間の手動判断のため、最終関門は維持されている
- DB新規テーブルは追加していない(候補・裁定はすべて`council-output/`配下のJSON/Markdownファイル
  で追跡する設計。ファイルで十分なため今回は提案のみで見送り)
- コスト見積り: Opus 4.8($5/$25 per 1Mトークン、1ドル150円換算)で1テーマ・2ラウンド・web_search
  数回込みの概算は1テーマあたり30〜90円程度と算出(実測は`runCouncilPipeline`実行時に
  ログ・Slack通知の両方に残す)。候補が多い場合の総コスト抑制のため、1回のパイプライン実行で
  評議会にかけるのはスコア上位5件までに制限(`MAX_CANDIDATES_TO_EVALUATE`)
- **初回実行結果(2026-07-18)**: `.env`にAPIキー・Webhook URLを設定後、`npm run council:run`を
  実データで実行。候補10件中スコア上位5件("agent"/"open"/"agents"/"source"/"built")を評議、
  裁定は保留3件・却下2件・採択0件、合計見積コスト約389.3円(1件あたり事前見積り30〜90円の
  レンジ内)。採択0件のため調査プロンプト生成はなし。Slack通知は5件ともエラーなく送信完了。
  `agent`の裁定JSONを確認したところ、監査役ロールが実際に3件のアンカリング(既存資産(テーマH
  差分検知)への追認バイアス・Round1総括への収束・市場規模数値への逆アンカリング)を具体的に
  検出しており、GOVERNANCE.mdの監査役ルールが意図通り機能していることを確認した
- **council-output/の扱い**: `.gitignore`には元々含まれておらず、`.env`のキー名や
  `hooks.slack.com`等の機密情報混入がないことをgrepで確認済み(該当なし)。以後、評議会実行の
  たびに生成される候補・裁定JSONは**意思決定の監査証跡として通常のgit管理下でコミットしていく**
  方針とする(`/data/raw`のような「再生成可能な大容量データ」とは異なり、評議会の裁定内容は
  再実行しても同じ結果にならないため、履歴として残す価値がある)

### テーマF(海外SaaS changelog/pricing)・G(パブコメ・審議会/報道発表)を調査・登録
AI評議会の裁定により追加した新テーマ2件。今回は生データ収集開始まで(パーサー実装は着手せず)。

- F: 海外SaaS 15社(Slack/Notion/Figma/Linear/Airtable/Miro/Zoom/Atlassian/Asana/HubSpot/
  Salesforce/Zendesk/Canva/GitHub/Stripe)のchangelog/pricingページ計30URLを調査
- G: e-Govパブコメ、8省庁(金融庁/経産省/総務省/厚労省/国交省/環境省/デジタル庁/個人情報保護
  委員会)の審議会・検討会ページ+報道発表資料一覧ページ計17URLを調査
- 判定はrobots.txt許可状況(自ボット`HarvestEngineBot`は`User-agent: *`扱い)・実地fetch可否
  (JS SPA/bot対策403/SSR本文あり)・RSS/API有無・更新頻度目安で実施
- e-Gov/meti.go.jpは調査エージェントのWebFetchツールで403が出たため、本番の`politeFetch`
  (実際のUA・robots尊重ロジック)で再検証を実施。meti.go.jpはrobots.txt自体・対象ページとも
  本番UAで403継続を確認したためinactive確定。e-Govはrobots.txt自体が存在せず(404)、
  `pcm/list`ページから直接リンクされているRSS(`/rss/pcm_list.xml`=意見募集中、
  `/rss/pcm_result.xml`=結果公示)を発見・確認できたためHTML一覧ではなくRSSを採用
- 環境省は当初調査対象だった`/council/`がナビゲーション型(日付なし)で差分検知に不向きと
  判明したため、実データのある子ページ`/council/o_info.html`に差し替えて再判定
- F: active15件・inactive8件(計23件)、G: active14件・inactive2件(計16件)の計39件をsourcesへ
  `createMany`のみで追記登録(既存46件は非削除)。ローカルDB(dev.db)は46→85件
- 登録時、`fetchIntervalMin`を意図的にばらつかせた(F changelogは日次前後、pricingは3日前後、
  Gは日次前後でそれぞれ+11〜+150分程度のジッターを付与)。VM空きメモリ(367Mi前後)がタイトな
  ため、全件が同一tickで同時fetchされ続ける状態を避ける狙い
- pending(判断保留)だった13件のうち11件はバックログ化(sourcesには登録せず、下記「新たに
  判明した課題」に記録するのみ)。ユーザー承認済み
- robots.txtが既知AIボット(GPTBot/ClaudeBot/CCBot/anthropic-ai等)を名指しでDisallowしている
  サイト(Canva)は、自ボットが`User-agent: *`の対象外でも原則active化しない方針を
  `CLAUDE.md`「巡回対象選定の追加ルール」に明文化
- 登録後、VM(161.33.148.155)にSSH接続し同じ39件を`createMany`で反映済み(下記参照)

### 経営体制の文書化: GOVERNANCE.md・BUDGET.md新設
- `GOVERNANCE.md`を新設。事業目的(利益前提)・組織体制(オーナー/GM/評議会/監査役/
  調査部/開発部/経理部/法務部)・オーナー専決事項とGM専決事項の切り分け・3層+出口Lite
  (第2.5層)の運営規律・監査役のアンカリング監査ルール・法務ゲート・1テーマ2万円の
  投下上限とサンクコスト禁止・撤退ライン(2027年夏時点で月商1万円未満なら評議会にかけ直す)
  を明文化
- `BUDGET.md`を新設。年間予算20万円(2026-08起点)、費目別配分(需要テスト8万/API4.8万/
  法務4万/ドメイン雑費1.2万/予備2万)、支出台帳の雛形(初期状態は支出ゼロ)、PL計画3
  シナリオ(コンサバ▲10万/ノーマル▲6.9万/楽観+33万、いずれも2026年12月〜2027年1月が分岐点)
  を記載
- `CLAUDE.md`に両ドキュメントへの参照行のみ追記(既存記述は変更なし)

### テーマH(ビジネスヒントのメタ・ハーヴェスト)を調査・登録
新テーマの着想原料を蓄積する、出口なし・60日判定なしの純粋な第1層収集テーマ。

- 調査対象: Product Hunt、Hacker News、はてなブックマーク(テクノロジー/世の中)、
  Reddit(r/SaaS・r/smallbusiness・r/japanlife)、Indie Hackers。e-Govパブコメはテーマ
  Gで既に登録済みのRSS(意見募集中/結果公示)をそのまま流用し、H用の重複登録はしない
- Reddit3件はrobots.txtで`User-agent: *` / `Disallow: /`(サイト全体禁止)を本番`politeFetch`
  で実機確認し、2026年のToS改訂(無許可収集の明示的禁止)とあわせてinactive確定。sources
  には登録せずHANDOFF記録のみ
- Indie Hackersはrobots.txt自体は許可的(robots.txt自体は403だが対象ページは200)だったが、
  本番`politeFetch`で取得した`/starting-up`の本文がFirebase設定のJSON blobのみでSSR本文
  (見出し)がゼロ件だったため、JS SPAと判断しinactive相当。sourcesには登録せず
- active5件(Hacker News Show HN/Ask HN、Product Huntフィード、はてなブックマーク
  テクノロジー/世の中)を`createMany`で追記登録(ローカル・VM双方)。Product HuntのGraphQL
  APIは規約上「商用利用不可(要問合せ)」のため見送り、公式Atomフィードで代替
- fetchIntervalMinはF/Gと同じジッター方式(日次前後+11〜+150分程度)を適用
- 登録後、VM側で実際にスケジューラが全34件(F/G/H active合計)を巡回し、**snapshotの
  httpStatusが全件200**であることを確認済み(判定に誤りなし)

## 現在の稼働状況

- sources合計: **ローカル106件**(active68/inactive38)。**VM未反映**(下記「次アクション」参照。
  従来のVM側90件(active57/inactive33、住友生命id=4の既知の不整合含む)からの差分は今回追加の
  H拡張13件+Indie Hackers1件+App Store公式RSS2件の計16件)
- 内訳:
  - 保険20社(生保10・損保10): 一部403のため一部inactive
  - Statuspage.io系15件+テーマC追加10件: 既存のまま(active見込み計8件、詳細は前々回HANDOFF参照)
  - **テーマF新規23件: active15 / inactive8**(inactive理由の内訳: JS SPA本文空4件、
    robots.txt明示Disallow1件、価格JS注入1件、bot対策403 1件、UA判定ブロック1件)
  - **テーマG新規16件: active14 / inactive2**(inactive2件はいずれもmeti.go.jpのWAF拒否)
  - **テーマH初回5件: active5 / inactive0**(inactive相当のIndie Hackers・Reddit3件はsources
    未登録のままバックログ)
  - **テーマH拡張13件: active7 / inactive6**(inactive内訳: Reddit robots.txt全面
    Disallow4件、JS SPA本文空1件(Uneed)、robots.txt名指しDisallow1件(THE BRIDGE))
  - **テーマH Indie Hackers1件: active1**(前回JS SPAと判定した`/starting-up`から
    ホーム(`/`)に対象URLを変更し本番politeFetchで再検証した結果、SSR確認によりactive化)
  - **テーマH App Store公式RSS2件(今回): active2**(依頼時の旧itunes.apple.com/rssは
    robots.txt Disallowで遮断、後継APIのtop-free JP/USに切替。新着チャートは後継API未提供の
    ため代替不可でsources未登録)
- incidentsパーサー実装済み: Slack/Notion/Zendesk、kintone/Office/Garoon/メールワイズ/freee
  (F/G/Hは未実装、収集のみ)
- Oracle VM(161.33.148.155)上でPM2+systemd常駐運用中(`harvest-engine-scheduler`/
  `harvest-engine-web`)。**F/G/H全体(active34件)の初回巡回後のメモリ実測**: 空き213Mi /
  available367Mi(used436Mi、buff/cache306Mi)。200Miの警戒ラインは下回っておらず、2台目VM・
  増強は現時点で不要と判断。ただし引き続きタイトな水準のため、次にテーマを追加する際は
  都度実測すること
- 経営体制: `GOVERNANCE.md`(組織・意思決定権限・3層運営規律)・`BUDGET.md`
  (年間予算20万円・支出台帳・PL計画3シナリオ)を新設。現時点で支出実績はゼロ
- 自動評議会パイプライン: `src/council/`実装済み(ローカルのみ、VM未反映)。初回実行済み
  (5候補評議・保留3/却下2/採択0・合計約389.3円)、`council-output/`を監査証跡としてコミット
  する方針。cron登録はまだ行っていない(今回のスコープ外、`npm run council:run`による
  手動実行のみ)

## 新たに判明した課題・次アクション

### 自動評議会パイプラインの次アクション
- `ANTHROPIC_API_KEY`・`SLACK_WEBHOOK_URL`は設定済み・実行確認済み(上記「今回変更したこと」参照)。
  ただし`.env`はdev-configのsync-list未登録のため、家PC・ノートPC間では都度手打ちが必要な状態。
  登録するかどうかはユーザー判断待ち
- VM側への`src/council/`反映・cron登録は未着手(今回のスコープ外)。半自動運用を続けるか
  完全自動化に進めるかはユーザー判断待ち
- 初回審議で「保留」となった3件("agent"/"agents"/"source")には監査役から具体的な次アクション
  条件(robots.txt実測、複合語への絞り込み等)が付与されている。次回評議会実行時にこれらが
  再度候補に挙がった場合、条件が満たされているかを踏まえて審議されることを想定

### テーマH拡張16件(拡張13件+Indie Hackers1件+App Store公式RSS2件)のVM反映(未着手)
今回の計16件(active10/inactive6)はローカルdev.dbのみに登録済み。VM(161.33.148.155)への
`createMany`反映は次回まとめて実施する想定(今回のスコープ外、ユーザー確認済み)。反映時は
本HANDOFFに記載の16件をそのまま`createMany`すればよい(deleteMany不使用・追記のみ)

### Tier2の残り(App Store以外)
- X: キーワード6語は評議会裁定で確定済み、`config/xKeywords.json`・`src/lib/xApi.ts`・
  `src/adapters/xKeywords.ts`で実装準備完了(sources未登録・実キー未設定)。次アクションは
  上記「オーナーがAPIキー設定後に行う手順」参照
- STARTUP DB低頻度手動チェック運用の具体化は別枠、今回未着手
- Google Playは公式feedが存在しないため対象外(今回の依頼で確定済み)

### ローカルDBとVM DBの不整合を発見(住友生命 id=4、F/G/H作業とは無関係)
ローカルdev.dbは`active=true`、VMは`active=false`で食い違っていた。過去のHANDOFF記録
(「恒常的な403と判断しactive=false変更済み(解消済み)」)から見てVM側のfalseが正しい状態と
見られるが、ローカルdev.dbだけ未更新のまま残っていた。本番はVMのため実害はないが、次回
ノートPC作業時にローカルdev.dbをfalseへ揃えるか、ユーザーに確認すること(今回も未対応のまま
保留)

### H(ビジネスヒント)バックログ(sources未登録、URLは判明済み)
- Reddit r/japanlife新着(`reddit.com/r/japanlife/new.json`等、robots.txt全面禁止+ToS明示
  禁止のため技術的検証以前に見送り)。r/SaaS・r/smallbusinessは今回(2026-07-18のH拡張調査)
  で`.rss`URLとしてsourcesにinactive登録済みのため本バックログからは除外(r/Entrepreneur・
  r/sideprojectも同様に今回inactive登録済み)
- Indie Hackers `/starting-up`(JS SPAシェルで本文取得不可、Puppeteer未対応が理由。ホーム(`/`)は
  2026-07-18の再調査でSSR確認によりsourcesにactive登録済みのため、`/starting-up`個別のみ
  バックログに残す)
- 上記は既存の「Puppeteer未対応」「robots.txt/ToS上の理由で見送り」の課題群と同種のため、
  個別の追跡は不要(URLは本記録に残っているので、状況が変われば再調査すればよい)

### F(海外SaaS)バックログ(sources未登録、URLは判明済み)
- Zoom changelog(support.zoom.com、ヘルプセンター配下でToSリスクありpending)
- Atlassian(Jira) pricing(価格表HTML混入が不確定、要再検証)
- Asana/Salesforce/Zendesk changelog(いずれもヘルプセンター配下+JS SPAで本文取得不可)
- HubSpot changelog(安定URL未特定、hubspot.com/product-updatesは無関係ページへ301転送)
- Stripe changelog(stripe.com/shippedはJS依存強、docs.stripe.com/changelogが代替候補、要調査)
- 上記7件はいずれもPuppeteer未対応が理由。既存の「Puppeteer未対応でinactiveのまま残っている
  保険5社+cybozu.com等4件」の課題と統合して扱う

### G(パブコメ・審議会)バックログ(sources未登録、URLは判明済み)
- 国土交通省 審議会・検討会ページ(`/policy/shingikai/index.html`、日付なしナビゲーション型で
  差分検知の粒度が低い。個別分科会ページへの分解が必要)
- 個人情報保護委員会 検討会ページ(`/personalinfo/kentohkai/`、テーマ別ポータルで更新頻度不明)

### パーサー実装時の注意点(未着手・メモのみ)
- 総務省(審議会・報道資料とも)は非UTF-8(Shift_JIS系と推定)エンコーディング。文字コード
  変換処理が必要
- Figmaはページ内にRSS購読ボタンがあるが具体的feed URLは未確定(将来HTML→RSS切替を検討)
- デジタル庁はサイト全体共通RSS(`/rss/news.xml`)があるが審議会/news個別のフィードではない
  ため今回はHTMLのまま登録
- Zendesk pricingはアクセス元IPによって`zendesk.co.jp/pricing`へ302転送される場合がある

### 既存の積み残し課題(変更なし)
- `statuspage:sync`のスキーマ不一致(Slack/Notion/Zendesk)は未対応のまま
- Puppeteer未対応のためinactiveのまま残っている10件(保険5社+cybozu.com/SmartHR/
  マネーフォワードME・biz/Chatwork)は引き続き未着手
