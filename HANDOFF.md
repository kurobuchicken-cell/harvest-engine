# HANDOFF

最終更新: 2026-07-18

## 今回変更したこと(何を・なぜ)

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

- sources合計: **90件**(ローカル active58/inactive32、VM active57/inactive33。差分1件は
  下記「住友生命」の既知の不整合)。**ローカル・VM双方に反映済み**
- 内訳:
  - 保険20社(生保10・損保10): 一部403のため一部inactive
  - Statuspage.io系15件+テーマC追加10件: 既存のまま(active見込み計8件、詳細は前々回HANDOFF参照)
  - **テーマF新規23件: active15 / inactive8**(inactive理由の内訳: JS SPA本文空4件、
    robots.txt明示Disallow1件、価格JS注入1件、bot対策403 1件、UA判定ブロック1件)
  - **テーマG新規16件: active14 / inactive2**(inactive2件はいずれもmeti.go.jpのWAF拒否)
  - **テーマH新規5件: active5 / inactive0**(inactive相当のIndie Hackers・Reddit3件はsources
    未登録のままバックログ)
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

### ローカルDBとVM DBの不整合を発見(住友生命 id=4、F/G/H作業とは無関係)
ローカルdev.dbは`active=true`、VMは`active=false`で食い違っていた。過去のHANDOFF記録
(「恒常的な403と判断しactive=false変更済み(解消済み)」)から見てVM側のfalseが正しい状態と
見られるが、ローカルdev.dbだけ未更新のまま残っていた。本番はVMのため実害はないが、次回
ノートPC作業時にローカルdev.dbをfalseへ揃えるか、ユーザーに確認すること(今回も未対応のまま
保留)

### H(ビジネスヒント)バックログ(sources未登録、URLは判明済み)
- Indie Hackers新着投稿(`indiehackers.com/starting-up`、JS SPAで本文取得不可。
  Puppeteer未対応が理由。なお内部でFirebase(`indie-hackers.firebaseio.com`)を使用している
  痕跡があるが、Hacker News APIのような公式公開ドキュメントが存在しないため、非公式エンド
  ポイントの探索は行っていない)
- Reddit r/SaaS・r/smallbusiness・r/japanlife新着(`reddit.com/r/*/new.json`等、robots.txt
  全面禁止+ToS明示禁止のため技術的検証以前に見送り)
- 上記4件は既存の「Puppeteer未対応」「robots.txt/ToS上の理由で見送り」の課題群と同種のため、
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
