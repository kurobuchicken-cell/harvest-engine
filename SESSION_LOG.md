# SESSION_LOG

## harvest-engine-setup-01（2026-07-16）
- 作業環境：ノートPC
- やったこと：
  - Week1: `sources`テーブル作成、保険20社(生保10・損保10)のseed投入(403の5社はactive=0、東京海上日動火災はHD RSSも追加、社名変更2社は新ブランドURLのみ)
  - Week2: `snapshots`/`changes`/`incidents`(Statuspageアダプタ用)テーブル追加、fetch_type別(html/json/rss/pdf)の巡回コアエンジン実装(robots.txt尊重・ホスト単位同時1接続・指数バックオフ・ハッシュ差分検知・変化時のみgzip保存)
  - `scheduler`をPM2で常駐化し、Windowsタスクスケジューラでログオン時`pm2 resurrect`による自動復旧を設定
- 完了した状態：
  - GitHub(kurobuchicken-cell/harvest-engine)にWeek1/Week2/PM2化の3コミットをpush済み(最新: `28a87f9`)
  - PM2で`harvest-engine-scheduler`が稼働中(fetch_interval_min=1440分=日次)。初回巡回完了、active16件中15件がhttp_status 200
  - タスクスケジューラ`HarvestEngineScheduler-PM2Resurrect`(ログオン時起動)を登録・動作確認済み
- 残課題・次にやること：
  - 住友生命(source id=4)が初回巡回でhttp_status 403だった。過去の調査時は問題なかった会社なので、次回以降の巡回でも継続するか確認し、継続するなら他5社と同様active=0に切り替える
  - Puppeteer未実装のため403のままの5社(アフラック/プルデンシャル/マニュライフ/東京海上日動火災の自社ページ/ソニー損保)は未着手
  - OCIへのデプロイは未実施(現状はノートPCでのPM2常駐のみ)
- 触ったファイル：`prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/`, `src/`配下一式, `ecosystem.config.js`, `tsconfig.json`, `.gitignore`

## harvest-engine-setup-02（2026-07-17）
- 作業環境：ノートPC
- やったこと：
  - PM2(`pm2 list`)・タスクスケジューラ(`HarvestEngineScheduler-PM2Resurrect`)の稼働確認。正常稼働中、クラッシュ再起動なし
  - 住友生命(id=4)の403は2周目の巡回データがまだ無く継続判定不可。今回は`active=true`のまま保留し、次回自動巡回後に再確認する方針に決定
  - Statuspage対象15件(Slack/Notion/Zoom/GitHub/Cloudflare/Stripe/Datadog/Zendesk/HubSpot/Twilio/Asana/Atlassian/Dropbox/Figma/Salesforce)を`sources`(insurance_type="statuspage")に登録し巡回テスト。結果、稼働できたのはSlack/Notion/Zendeskの3件のみ
    - Slack/Zendeskは元URL(`/api/v2/summary.json`)が404だったため現行の正しいAPIエンドポイントに差し替え
    - Zoom/GitHub/Cloudflare/Stripe/Datadog/HubSpot/Twilio/Asana/Atlassian/Dropbox/Figma(11件)はStatuspage.io標準robots.txtの`Disallow: /api/`により取得不可と判明、robots.txt尊重ポリシーに従いactive=falseで登録
    - Salesforceはrobots.txtではなくサーバー側で直接API拒否(403 "Direct API access not allowed")のためactive=false
    - `statuspage:sync`(incidents自動パース)は稼働3社とも実際のレスポンススキーマがアダプタ前提の`incidents`配列と一致せず、常に「新規0件」になる既知の制約が判明(今回はスコープ外として未対応)
  - PM2常駐プロセスのコンソールウィンドウ(黒い画面)についての質問に回答。tsx実行時に生成される子プロセスの表示ウィンドウで、閉じると一時停止するがautorestartで復旧する旨を説明
  - ノートPCシャットダウン時の挙動について質問に回答（ログオン時にpm2 resurrectで自動復旧するが、dev.db等はgitignore対象でPC間非同期である点を説明）
  - OCIデプロイの検討。Oracle Always Free枠の現状(2026/6/15にAmpere A1が4OCPU/24GB→2OCPU/12GBに無告知で半減、無料インスタンスの予告なし停止報告あり)をWeb検索で確認。また`auto_x-app`が既にOracle VM(`ubuntu@141.147.175.174`, VM.Standard.E2.1.Micro=AMD 1OCPU/1GB RAM, Always Free)で本番Bot(`northeption-sns-bot`)を稼働中と判明。同VMは1GB RAMでOOMリスクが既知のため相乗りは避け、AMD Always Free枠のもう1台(2台目のMicroインスタンスも無料)を新規に立てる方針に決定
- 完了した状態：
  - `prisma/seed.ts`にStatuspage15件を追記・コミット・push済み(`9f93337`)。DBにも同内容を反映済み(sources合計36件、active15/inactive21)
  - 住友生命(id=4)は判断保留、active=trueのまま
  - OCIデプロイは「2台目のAMD Micro Always Freeインスタンスを新規に立てる」方針のみ決定。実作業は未着手
- 残課題・次にやること：
  - 住友生命(id=4)の403継続確認は次回巡回結果を見てから判断
  - OCIデプロイの実作業(インスタンス作成・Node環境構築・PM2移行・巡回スケジュール反映)は次回別セッション(`harvest-engine-oci-setup-01`)で実施
  - `statuspage:sync`のスキーマ不一致(Slack/Zendesk/Notionそれぞれ独自形式でincidents配列と一致しない)は未対応。将来incidents自動検知が必要になったら個別パーサー対応を検討
  - Puppeteer未実装のため403のままの保険5社は引き続き未着手
- 触ったファイル：`prisma/seed.ts`

## harvest-engine-oci-setup-01（2026-07-17）
- 作業環境：ノートPC
- やったこと：
  - 別プロジェクト(fumotoppara-monitor)用に既存Oracle VM(141.147.175.174)上に構築済みだったOCI API認証(`~/.oci/config`、`~/bin/oci` CLI本体)を発見・流用し、harvest-engine専用の2台目AMD Microインスタンス(VM.Standard.E2.1.Micro、Always Free、display-name: harvest-engine、パブリックIP: 161.33.148.155)をOCI CLI経由で新規作成
  - harvest-engine専用のSSH鍵(`harvest_engine_vm_key`)を新規生成し`C:\dev\harvest-engine\tokens\`に配置。`.gitignore`に`tokens/`を追加し、dev-configの`sync-list.txt`にも登録してPC間同期対象にした
  - VM上にNode.js 22.x + PM2をセットアップ。1GB RAMでのnode-gypビルドOOM対策として2GBのswapfileを追加(実際はbetter-sqlite3がprebuiltバイナリで済みソースビルドは発生せず)
  - リポジトリをclone、`npm ci`、`npx prisma generate`を実行
  - DB移行はノートPCの`dev.db`+`data/raw`(収集済みsnapshot履歴、合計200KB程度)をそのままscpで移送する方針を採用(サイズが小さく無料枠を圧迫しないため。新規seedからのやり直しはせず履歴を引き継いだ)
  - `ecosystem.config.js`(Windows対策のtsx直接実行構成)はそのままLinux上でも問題なく動作しPM2起動成功
  - `pm2 startup systemd` + `pm2 save`でOS起動時の自動復旧を設定し、実際にVMを再起動してPM2が自動復旧することを検証済み
  - html/rss/json、3種のfetch_typeで手動巡回テストを実施し、Oracle VM側のIPからのアクセスブロックがないことを確認
  - 住友生命(id=4)がOracle VMの別IPからも403だったため、IPブロックではなく恒常的な拒否と判断し`active=false`に変更(前回セッションからの継続確認の残課題を解消)
  - ノートPC側のPM2常駐プロセス(`harvest-engine-scheduler`)を停止・削除、タスクスケジューラ登録(`HarvestEngineScheduler-PM2Resurrect`)も削除し、Oracle VM側に一本化
- 完了した状態：
  - harvest-engineの巡回スケジューラはOracle VM(161.33.148.155)上でPM2+systemd常駐運用に完全移行済み。ノートPCの電源状態に依存せず24時間稼働する
  - ノートPC側のPM2・タスクスケジューラは削除済み(二重巡回なし)
  - Oracle Always Freeの2台目AMD Microインスタンスも無料枠内(`free-tier-retained: true`を確認済み)
- 残課題・次にやること：
  - Puppeteer未実装のため403のままの保険5社(アフラック/プルデンシャル/マニュライフ/東京海上日動火災自社ページ/ソニー損保)は引き続き未着手
  - `statuspage:sync`のスキーマ不一致(Slack/Zendesk/Notion)は未対応のまま
  - Oracle VM(161.33.148.155)をOCI Console上で目視確認していない(CLI経由でのみ作成)。次回ノートPC作業時にConsoleで一覧確認しておくと安心
  - Oracle Always Free枠のAMD Microインスタンスは2台とも使用済み(141.147.175.174: auto_x-app、161.33.148.155: harvest-engine)。3台目が必要な場合はA1 Flex枠(在庫待ちが必要、fumotoppara-monitorが既にリトライ中)を検討することになる
- 触ったファイル：`.gitignore`、`tokens/harvest_engine_vm_key`・`tokens/harvest_engine_vm_key.pub`(新規・gitignore対象で非公開)、Oracle VM(161.33.148.155)側のリポジトリ・DB・PM2設定一式(ローカルGit管理外)

## harvest-engine-web-publish-01（2026-07-17）
- 作業環境：ノートPC
- やったこと：
  - C公開ページ(src/web/)を`https://saas-status.com`として外部公開。方式はCloudflare Tunnel(既存Oracle VM 161.33.148.155上)、ドメインは`saas-status.com`(取得は人間側で実施済み)
  - VM上に`harvest-engine-web`をPM2で追加デプロイ(既存schedulerと同一PM2デーモン、`--only`起動で無関係に影響させず)。cloudflaredをVMにインストールしsystemdサービス化、Tunnel作成・DNSのCNAME(Proxied)設定
  - Tunnel作成ウィザードの「Route Traffic」画面を未入力のまま離脱するとingress設定が空のまま残り503になる不具合を踏み、DNSレコード削除→Published application routesから作り直しで解消(ブラウザ操作はユーザーがスクリーンショット共有→Claudeが次の操作を指示する形で進行)
  - `src/web/server.ts`に`/robots.txt`・`/sitemap.xml`を追加(このサイト自身はAllow: /、harvest-engine本体が守るrobots.txtとは逆の立場)
  - 外部疎通確認の過程で、VM側DBにtheme C 10ソース(サイボウズ4製品/cybozu.com/freee/SmartHR/マネーフォワードME・biz/Chatwork)自体が存在しないこと(DB移行scpのタイミングがsource追加より前だったため)、およびローカルで作成済みの81件のincidentsがVMに反映されていないことを発見
  - VM sourcesに10件を`createMany`で追記(既存36件は無傷、IDもローカルと一致する37-46)。ローカルの81件incidentsを`sourceChangeId=NULL`でVMへ直接INSERT移植(rawスナップショットがVMに無くFK維持不可のため。DBファイル丸ごと置き換えはVM独自収集データの消失リスクがあるため不採用)
  - 移植の過程で、以前のセッションで実装済みだったが未コミットのまま残っていた`source_url`列追加(schema変更+migration+各パーサー)を今回コミットし、VMに`prisma migrate deploy`+`prisma generate`+PM2再起動で反映
  - HANDOFF.md更新
- 完了した状態：
  - `https://saas-status.com/`が正常稼働。トップ8社一覧・詳細ページ・robots.txt・sitemap.xml・出典リンク・免責文言すべて確認済み
  - VM側`harvest-engine-web`はPM2管理下で`pm2 save`済み(既存schedulerと同じsystemd resurrect対象)、cloudflaredも`systemctl enable`済みで再起動後も自動起動
  - VM側sources/incidentsがローカルと同期(46件/81件)。scheduler・web・cloudflared同時稼働でメモリ安定(空き300Mi台を維持、restart回数0、OOM無し)
- 残課題・次にやること：
  - 運用上の教訓として、ローカルでのDB変更(sources追加・スキーマ変更)はgit pushだけではVM側DBに反映されない。今後は変更のたびにVM側への反映(seed追記・migrate deploy)を都度確認する
  - Cloudflare Zero Trustはアカウントの支払い方法登録が必須(Free枠のまま、$0/月)だった点は事前に共有済み
- 触ったファイル：`src/web/server.ts`(robots/sitemap追加、BASE_URL修正)、`ecosystem.config.js`(harvest-engine-web追加)、`package.json`、`prisma/schema.prisma`、`prisma/migrations/20260717044709_add_incident_source_url/`、`src/adapters/incidents/{cybozuRss,hund,notion,parseChange,slack,types,zendesk}.ts`、`src/adapters/incidents/backfillSourceUrl.ts`(新規)、`HANDOFF.md`、Oracle VM側のsources/incidentsテーブル・PM2設定・cloudflared設定一式(ローカルGit管理外)

## harvest-engine-themeFG-onboard-01（2026-07-18）
- 作業環境：ノートPC
- やったこと：
  - AI評議会裁定によるテーマF(海外SaaS changelog/pricing)・G(パブコメ・審議会/報道発表)の
    新設。並列サブエージェント4本でF15社30URL・G17URLを調査(robots.txt・実地fetch可否・
    RSS/API有無・更新頻度)し、e-Gov/meti.go.jpは本番の`politeFetch`で追加の実機再検証を実施
  - 承認を得てsourcesへ計39件(F23件・G16件)を`createMany`で追記登録(ローカルDBのみ、
    既存46件は非削除)。pending 13件中2件(e-Gov RSS採用・環境省URL差し替え)は登録に反映、
    meti.go.jp 2件はinactive確定、残り11件はsources未登録のままバックログ化
  - `CLAUDE.md`に「robots.txtが既知AIボットを名指しでDisallowしているサイトは自ボットが
    対象外でもactive化しない」ルールを追記
  - `HANDOFF.md`更新
- 完了した状態：
  - ローカルDBのsources合計85件(active53/inactive32)。詳細な内訳・バックログURL一覧・
    パーサー実装時の注意点(総務省Shift_JIS等)は`HANDOFF.md`参照
  - パーサー(price_changes/feature_changes等)は今回未着手。収集開始のみ
- 残課題・次にやること：
  - **VM側DBへの39件反映が未実施**(次回セッションで最優先。ローカルのみの変更はpushだけでは
    VMに伝わらない教訓を踏襲)
  - F/Gバックログ11件(URL判明済み、Puppeteer未対応等が理由)は`HANDOFF.md`に一覧化済み
- 触ったファイル：`prisma/seed.ts`(F/G追記)、`CLAUDE.md`(巡回対象選定ルール追加)、
  `HANDOFF.md`、ローカルDB(`dev.db`、Git管理外)のsourcesテーブル

## harvest-engine-vm-sync-and-governance-01（2026-07-18）
- 作業環境：ノートPC
- やったこと：
  - 前セッションで積み残しだったF/G 39件のVM側DB反映をSSH経由で実施(ローカルと同じ
    `createMany`ワンオフスクリプトをVMに転送・実行)。作業中にローカルdev.dbとVMで
    住友生命(id=4)のactiveフラグが食い違っていることを発見(今回作業とは無関係の既存の
    不整合、対応は保留)
  - 経営体制の文書化として`GOVERNANCE.md`(経営憲法: 事業目的・組織体制・オーナー/GM
    権限分界・3層+出口Lite運営規律・監査役のアンカリング監査・法務ゲート・2万円投下上限・
    撤退ライン)と`BUDGET.md`(年間予算20万円・費目別配分・支出台帳雛形・PL計画3シナリオ)を
    新設。`CLAUDE.md`には参照行のみ追記
  - `CLAUDE.md`の「テーマ運営の原則」を詳細版に更新し、GOVERNANCE.mdの概要セクションとの
    概要/詳細の関係を明記。第2.5層(出口Lite)・2→2.5→3の昇格パス・2万円上限ルールを追加
- 完了した状態：
  - VM側sources合計85件(active52/inactive33)。ローカル(active53)との差分1件は住友生命の
    既知の不整合のみ
  - GOVERNANCE.md・BUDGET.mdはリポジトリ直下に新設済み、コミット・push済み
- 残課題・次にやること：
  - 住友生命(id=4)のローカル/VM不整合は未解消のまま(次回ノートPC作業時に確認)
  - BUDGET.mdの支出台帳は初期状態(支出ゼロ)のまま。実際の支出発生時に追記する運用
- 触ったファイル：`GOVERNANCE.md`(新規)、`BUDGET.md`(新規)、`CLAUDE.md`(参照行・
  テーマ運営の原則更新)、`HANDOFF.md`、VM側(`/home/ubuntu/apps/harvest-engine`)のsources
  テーブル

## harvest-engine-themeH-onboard-01（2026-07-18）
- 作業環境：ノートPC
- やったこと：
  - 新テーマH(ビジネスヒントのメタ・ハーヴェスト、出口なし・60日判定なしの純粋な第1層
    収集テーマ)を新設。並列サブエージェント2本でProduct Hunt/Hacker News/Indie Hackers/
    はてなブックマーク/Redditを調査し、Indie HackersとRedditは本番`politeFetch`で追加の
    実機再検証を実施(Indie HackersはFirebase設定JSONのみでSSR本文なしと判明、Redditは
    `Disallow: /`のサイト全体禁止を実機確認)
  - e-GovパブコメはテーマGで登録済みのRSSをそのまま流用し、H用の重複登録を回避
  - 承認を得てactive5件(Hacker News Show HN/Ask HN、Product Huntフィード、はてなブックマーク
    テクノロジー/世の中)をsourcesへ`createMany`で追記登録(ローカル・VM双方、fetchIntervalMinは
    F/Gと同じジッター方式)。Indie Hackers・Reddit3件はsources未登録のままHANDOFF.mdへ
    バックログ記録
  - VM側で実際にスケジューラがF/G/H active合計34件を巡回し、snapshotのhttpStatusが全件200で
    あることを確認。登録直後のメモリ実測(空き213Mi/available367Mi)もHANDOFF.mdに記録
- 完了した状態：
  - sources合計90件(ローカルactive58/inactive32、VM active57/inactive33)。F/G/H合計active
    34件はいずれも実機巡回でhttpStatus 200を確認済み
  - VMメモリは200Miの警戒ラインを下回っておらず、2台目VM・増強は現時点で不要と判断
- 残課題・次にやること：
  - Hバックログ4件(Indie Hackers、Reddit3件)は`HANDOFF.md`に記録済み。状況が変わった場合の
    み再調査
  - 住友生命(id=4)のローカル/VM不整合は引き続き未解消
- 触ったファイル：`prisma/seed.ts`(H追記)、`HANDOFF.md`、ローカルDB(`dev.db`、Git管理外)・
  VM側(`/home/ubuntu/apps/harvest-engine`)のsourcesテーブル

## harvest-engine-council-pipeline-01（2026-07-18）
- 作業環境：ノートPC
- やったこと：
  - テーマ量産構想②段階「自動評議会パイプライン」を`src/council/`に新規実装(候補抽出→
    評議会裁定(Claude Opus 4.8+web_search)→Slackカード通知→採択テーマの調査プロンプト
    自動生成)。手動実行(`npm run council:run`)とcron実行が同じ`runCouncilPipeline()`を
    呼ぶ構造にし、将来の完全自動化に備えた
  - GOVERNANCE.mdをシステムプロンプトに埋め込み、アンカリング防止指示を明文で固定。
    Slack承認のインタラクティブ検知は追加インフラが必要なためスコープ外とし、評議会が
    「採択」と裁定したテーマは自動的にプロンプト生成まで行う方式で確定(ユーザー承認済み)
  - `extractCandidates.ts`はローカルで実際にテーマH5ソースを巡回し、実データ(rawスナップ
    ショットのgzファイル)から日本語2-3gram/英語単語分割の軽量頻度分析で候補抽出できることを
    確認("agent"score20等、意味のある候補を抽出)
  - `@anthropic-ai/sdk`を新規追加(唯一の新規依存)。`.env`に`ANTHROPIC_API_KEY`・
    `SLACK_WEBHOOK_URL`のプレースホルダを追加
  - オーナーが`.env`にAPIキー・Webhook URLを入力後、`npm run council:run`を実データで実行。
    候補10件中上位5件を評議、裁定は保留3/却下2/採択0、合計見積コスト約389.3円(事前見積り
    レンジ内)。`agent`の裁定を確認したところ監査役が3件の具体的なアンカリングを検出しており、
    GOVERNANCE.mdの監査役ルールが意図通り機能していることを確認した
  - `council-output/`配下に機密情報(APIキー・Webhook URL等)が混入していないことをgrepで確認し、
    以後は意思決定の監査証跡として通常のgit管理下でコミットしていく方針に確定
- 完了した状態：
  - `src/council/{types,extractCandidates,runCouncil,notify,generatePrompt,run}.ts`実装済み、
    `tsc --noEmit`型エラーなし
  - `extractCandidates.ts`・`runCouncil.ts`・`notify.ts`ともに実データで動作確認済み
  - `council-output/candidates/`・`council-output/verdicts/`に初回実行の実データが生成済み、
    コミット対象として確定
- 残課題・次にやること：
  - `.env`はdev-configのsync-list未登録。家PC・ノートPC間の同期方法はユーザー判断待ち
  - VM側への反映・cron登録は今回のスコープ外(手動実行の半自動運用のまま)
  - 「保留」となった3候補("agent"/"agents"/"source")には監査役から再審議の条件が付与されて
    いる(詳細は`council-output/verdicts/*.json`・`HANDOFF.md`参照)
- 触ったファイル：`src/council/`(新規6ファイル)、`package.json`・`package-lock.json`
  (`@anthropic-ai/sdk`追加、`council:run`スクリプト追加)、`.env`(プレースホルダ追加、
  Git管理外)、`HANDOFF.md`、`council-output/`(新規、候補・裁定JSON)

## harvest-engine-theme-and-governance-01（2026-07-18）
複数工程(Hテーマ拡張・X連携・経理部実体化・執行役体制移行・評議会再設計)を1セッションで
通した回。本来はセッション分割の目安に反するが、実際の作業順序をそのまま記録する。
- 作業環境：ノートPC
- やったこと：
  - **テーマH情報源拡張**: 供給観測軸(BetaList/Fazier/SaaSHub)・国内メディア(Coral Capital/
    KEPPLE、kepple.coはドメイン失効でkepple.co.jpに差替え)・検証層(Google Trends JP/US)・
    Reddit4件(inactive、robots.txt全面Disallow)・Uneed/THE BRIDGE(inactive)を実地調査し
    13件登録。追加でIndie Hackers(前回JS SPA判定を再検証しSSR確認、active化)、App Store
    公式RSS(旧itunes.apple.com/rssはrobots.txt Disallow、後継API rss.marketingtools.apple.comの
    top-free JP/USに切替)を登録。ローカルsources 90→112件
  - **X(公式API)キーワード監視の実装**: 評議会裁定の仮運用6語を`config/xKeywords.json`で管理、
    `src/lib/xApi.ts`(X API v2 Recent search)・`src/adapters/xKeywords.ts`(since_id増分取得・
    呼び出し数/月間上限の安全装置)を実装。汎用`crawler.ts`のfetchByTypeには意図的に`x_search`を
    追加せず独立スクリプトとした。オーナーがBearer Token設定後、実API疎通確認(6キーワード×20件
    =120件取得成功)
  - **経理部の実体化**: 同日中に記帳漏れ2件・モデル切替提言の失念1件が発生したことを受け、
    `src/lib/ledger.ts`(支出台帳、記帳時に外部API(open.er-api.com)から為替レート取得、
    ハードコード禁止)・`npm run ledger:report`を新設。`src/lib/xApi.ts`はAPI呼び出し成功直後に
    自動記帳する設計に変更。既存の手書きBUDGET.md記帳(Perplexity・Xクレジット)をledgerへ移行
  - **執行役体制のドキュメント化**: `RULES.md`(執行役の運用ルール: ネガティブリスト・評議会
    トリガー・モデル切替基準・経理/法務・報告テンプレート)、`DECISIONS.md`(ハーヴェスト1着想〜
    正式始動〜本日までの意思決定ログ)を新設。CLAUDE.mdは参照行のみに整理し重複記載を解消。
    チャット(Claude.ai)からこのCCセッションへ執行役の役割を正式に引き継いだ
  - **評議会パイプラインの再設計**: オーナー方針(「情報の選定は新プロジェクト成否のカギ」)を
    受け、候補選定を頻度カウントから選定専用のAI評議会(`selectCandidates.ts`新設)に置き換え。
    判断評議会(`runCouncilForTopic`)は無改修。`runCouncil.ts`の為替ハードコード(1ドル150円)を
    撤去しledger連携に統一。実行確認: 生データ326件→選定4件(約321円)→判断で採択2件・保留2件
    (合計約870円)。頻度カウント時代(採択0件)より明確に質が向上
  - **評議会の週次cron化・VMデプロイ**: `src/councilScheduler.ts`+PM2の3プロセス目
    (`harvest-engine-council-scheduler`、毎週月曜09:00 JST)を追加。VM未pushコミット7件を
    オーナー確認の上push、VM側`git pull`・H拡張22件の`createMany`反映・巡回実施を確認。
    VM側`.env`にAPIキー3種が未設定だったため、SSH経由で値を一切表示せずローカルから転送
    (1件転送漏れが発生、件数確認で検知し再送・復旧)
  - **評議会JSONパースバグの発見・修正**: オーナーがSlack通知の1件が「パース失敗」表示に
    なっているのを発見。原因はOpus出力の```json```末尾に余分な閉じ括弧。フォールバックが
    常に「保留」を返す設計だったため、本来「採択/却下」だった場合に黙って握り潰すリスクが
    あった(今回は実害なしと確認)。`councilCore.ts`に`extractJsonBlock()`(末尾を最大20文字
    まで削って再パースする復旧ロジック)を追加し修正、VMにも反映・PM2再起動済み
  - **手続き上のミス2件を自己申告**: 未push複数コミットをまとめてpushする際に事前確認を
    取らずに実行した件、VM側`npm install --omit=dev`でtsx(devDependency)を誤って削除しかけ
    他プロセスを巻き込むリスクを生んだ件(いずれも復旧・報告済み)
- 完了した状態：
  - ローカルsources 112件(active74/inactive38)、VM反映済み(active73、住友生命id=4の既知の
    差分のみ)
  - `data/ledger.json`累計支出35,587円(消化率17.8%、API費目のみ74.1%)。ローカル・VMそれぞれ
    別ファイルのため合算未整備
  - VM PM2は3プロセス(`scheduler`/`web`/`council-scheduler`)とも安定稼働、`git log`は
    `81456c1`まで反映済み
  - 評議会採択2件の調査プロンプトが`council-output/`に生成済み、CCへの投入可否はオーナー
    判断待ち(次セッションへの引き継ぎ事項)
- 残課題・次にやること：
  - 採択2テーマ(AIエージェント可読性・AEO/GEO最適化、AIエージェント運用ガバナンス・事故制御)の
    調査プロンプト投入可否
  - `.env`のdev-config sync-list登録可否(ANTHROPIC_API_KEY/SLACK_WEBHOOK_URL/
    SLACK_MENTION_USER_ID/X_BEARER_TOKEN)
  - ローカルDBとVM DBのactive不整合(住友生命id=4)の解消方法
  - 次フェーズ: 監査役週次バッチ、法務部ゲート化、ローカル/VM ledger合算、STARTUP DB具体化、
    Substack/noteキュレーション
  - 詳細な技術的backlogはHANDOFF.md「新たに判明した課題・次アクション」参照
- 触ったファイル：`prisma/seed.ts`、`config/xKeywords.json`(新規)、`src/lib/xApi.ts`・
  `src/lib/ledger.ts`(新規)・`src/ledgerReport.ts`(新規)、`src/adapters/xKeywords.ts`(新規)、
  `src/council/`(selectCandidates.ts・councilCore.ts・pricing.ts新規、他改修)、
  `src/councilScheduler.ts`(新規)、`ecosystem.config.js`、`package.json`、`RULES.md`・
  `DECISIONS.md`(新規)、`CLAUDE.md`、`GOVERNANCE.md`・`BUDGET.md`、`HANDOFF.md`、
  `data/ledger.json`(新規)、`council-output/`、VM側`.env`・sources・PM2設定

## harvest-engine-ops-and-docs-01（2026-07-18）
- 作業環境：ノートPC
- やったこと：
  - 評議会採択2テーマ(AEO/GEO最適化・AIエージェント運用ガバナンス)を実地調査し、テーマI(AI Incident Database)を第1層登録。ローカル・VMのsources113件を完全一致させた
  - VM側`.env`の`DATABASE_URL`破損(141文字・クォート始まり)を発見・修復。バックアップ取得後にDATABASE_URL行のみ安全に置換、council-schedulerをpm2 restartして復旧確認
  - 経理部の「監査役週次バッチ」を実装しPM2に常駐化(`harvest-engine-audit-scheduler`、毎週月曜10:00 JST)。Slack通知も追加し、実際の配信をオーナーに確認していただいた。実装中にバグ3件(週次実行ログの取り違え、mainの無条件実行、dotenv未import)を発見・修正
  - 法務部の「ゲート化」を実装(`npm run legal:record`/`legal:check`)。既存テーマCの一次審査(robots.txt/ToS/商標)をGMが実施し出口Lite要件PASSを確認、弁護士相談のみオーナー対応待ちとして残した
  - `会社説明資料.html`を新規作成(中学生でも分かる言葉での会社説明)。CLAUDE.mdに更新ルールを登録
  - 【追記】オーナーが会社説明資料.htmlを見て、「第2層5テーマ・第3層2テーマまで」という同時運用上限が「無数の小さな力を同時に積み上げる」というハーヴェストの思想と矛盾すると明確に指摘。GOVERNANCE.md・CLAUDE.md・会社説明資料.htmlの件数上限を撤廃し、DECISIONS.mdに経緯を記録。ただし各層への昇格プロセス(法務ゲート・オーナー承認・60日判定)は件数が増えても1件ずつ省略なく厳格に運用する方針もあわせて明記。今後のセッションでも同じ誤りを繰り返さないよう記憶にも保存した
  - 【追記】会社説明資料.htmlの「今動いているプロジェクト」が一行テーブルでサービス内容が伝わらないとの指摘を受け、テーマごとに「集めている情報」「できること/目指す形」「誰が嬉しいか」を含むカード形式に拡充
- 完了した状態：
  - ローカル・VMのsources合計113件(active74/inactive39)で完全一致
  - PM2はVM上で4プロセス(scheduler/web/council-scheduler/audit-scheduler)体制、pm2 save済み
  - `data/legalChecklist.json`にテーマCの4項目(robotsTxt/tos/disclaimer/trademark)を記録、`npm run legal:check -- C 2.5`はPASS
  - GOVERNANCE.md・CLAUDE.mdのテーマ運営ルールから同時運用件数上限を撤廃済み(思想との整合性を訂正)
  - HANDOFF.mdは本セッションの変更をすべて反映済み
- 残課題・次にやること：
  - テーマCのフル出口(第3層)昇格には弁護士スポット相談のみ残っている(オーナー対応)
  - 次フェーズ: ローカル/VMのledger合算、STARTUP DB運用具体化、Substackキュレーション
  - HANDOFF.md「新たに判明した課題・次アクション」参照
- 触ったファイル：`prisma/seed.ts`、`CLAUDE.md`、`HANDOFF.md`、`GOVERNANCE.md`、`DECISIONS.md`、`src/auditReport.ts`・`src/auditNotify.ts`・`src/auditScheduler.ts`・`src/lib/slackWebhook.ts`（新規）、`src/council/notify.ts`、`src/lib/legalChecklist.ts`・`src/legalRecord.ts`・`src/legalCheck.ts`（新規）、`data/legalChecklist.json`（新規）、`会社説明資料.html`（新規・複数回更新）、`ecosystem.config.js`、`package.json`、VM側`.env`・PM2設定・sourcesテーブル

## harvest-engine-homepc-env-sync-01（2026-07-20）
- 作業環境：家PC
- やったこと：
  - このフォルダを家PCで作った記憶がないというオーナーの疑問を調査。git reflog・
    PowerShell履歴・全プロジェクトのClaude Codeセッションログを横断確認した結果、
    2026-07-17に別プロジェクト(`auto_x-app`)のセッション内で「ノートPCのプロジェクトを
    家PCに引き継ぎたい」という依頼を受けてClaudeが`git clone`していたことが判明(家PC単独の
    セッションでの作業ではなかった)
  - ノートPC側で2026-07-16〜18に進んでいた作業(origin/mainで50コミット先行、council評議会
    パイプライン・監査役週次バッチ・経理台帳・法務ゲート・Web公開ページ等)を家PCに同期。
    `git pull`(fast-forward)・`npm install`(7パッケージ追加)・
    `npx prisma migrate deploy`(`20260717044709_add_incident_source_url`)を実施
- 完了した状態：
  - 家PCのgit・npm依存関係・ローカルDB(`dev.db`)スキーマがノートPC最新状態(`562d7a8`)に
    追いついた。`.env`・`node_modules`とも既存(2026-07-17のclone時に作成済み)で問題なし
- 残課題・次にやること：
  - 家PC側のローカルDB(`dev.db`)はスキーマこそ最新だが、実データ(sources/snapshots等)は
    未検証。実際に巡回や評議会コマンドを家PCで動かす場合は、VM側(Oracle VM運用が本流)との
    使い分けを事前に確認する
  - HANDOFF.md「新たに判明した課題・次アクション」は今回未確認。次回家PCで作業する際は
    軽く目を通すとよい
- 触ったファイル：`package.json`・`package-lock.json`(npm install反映)、`prisma/migrations/`
  適用(`dev.db`)、`SESSION_LOG.md`

## harvest-engine-council-audit-bugfix-01（2026-07-20）
- 作業環境：家PC
- やったこと：
  - オーナー依頼で各部門(巡回/評議会/監査役/経理/Web/法務)の本日の稼働状況をVM上のPM2ログ・
    ledger・council-outputで調査。巡回は正常だったが評議会と監査役の2件に問題を発見
  - **評議会のバグ修正**: 今日00:00 UTCの週次自動実行が、7/18に追加したApp Store
    top-freeソース(fetchType="json"だがHacker Newsとは全く別のJSON形式
    `{feed:{results:[...]}}`)を`itemsFromHnIdList`が誤ってHN専用パーサーでパースしようと
    し`TypeError: ids is not iterable`でクラッシュ、生データ収集の時点で今週分が丸ごと
    失敗していたと判明。`src/council/extractCandidates.ts`にURLホスト別の分岐
    (`itemsFromAppStoreJson`新設)と、未知のjson形式は例外を投げず1件だけスキップする
    防御を追加して修正(`d86f912`、VM・ローカル双方に反映、council-scheduler再起動済み)
  - **監査役の異常**: 週次cron(月曜01:00 UTC)が発火した形跡がログに一切なく原因不明
    (node-cron自体の設定・VMのタイムゾーンがUTCであることは確認済み、次回月曜7/27に
    正常発火するか要経過観察)。audit-schedulerもPM2再起動済み
  - 評議会の今週分をキャッチアップ実行(VM上でnpm run council:run)。生データ500件収集
    (直近7日分、`WINDOW_DAYS=7`+`MAX_ITEMS=500`キャップの一括処理であり「1日500件」
    ではない旨オーナーに説明)→候補4件選定(590円)→判断2件(中古・リファービッシュ端末=
    保留232円、GEO/AI被引用可視化=却下182円)まで進んだところで`Anthropic API`の
    `credit balance too low`エラーで停止(合計1,004円は正常に記帳済み、失敗分の課金なし)
  - 監査役の今週分もキャッチアップ実行(1回目はdotenv読み込み忘れでSlack通知がスキップ
    されたが気づいて再実行、正常送信を確認)。記帳失敗・為替未解決なし、評議会週次実行
    との突合もOK
  - オーナーがAnthropic Consoleで$20のクレジット追加を試みるも決済失敗(Stripe
    「Payment failed」、メールでも$22の請求失敗を確認)。Web検索で調査した結果、
    Anthropic/Stripe側で多数報告されている既知の不具合(Link経由の保存済みカードが
    一度拒否されると別カードに切り替えても同じ拒否済みトークンを使い回す等)の可能性が
    高いと判明。三井住友VISAへの問い合わせ方法(不正検知ブロックの確認・解除依頼)を案内
    したが、本セッション終了時点で決済は未解決。**残り2件(候補3「AIエージェント運用の
    ガードレール」・候補4「広告体験の劣化とダークパターン規制」)は中断中**
  - **ラップトップへの引き継ぎ準備**:
    - dev-configの`harvest_engine_vm_key`がWindows(`core.autocrlf=true`)でチェックアウト
      時にCRLF化されOpenSSH形式としてパース不能になっていた不具合を発見・修正。
      git上のオブジェクト自体はLFのまま壊れていなかったため、`.gitattributes`で
      鍵・トークン類を`-text`指定して恒久対応(dev-config `8163e0a`)。ついでに
      `auto_x-app`の`oracle_vm_key`も同じ問題を抱えていたため同時に修正
    - VM側に溜まっていた未コミットの実データ(ledger・council-output)を、VM自体に
      GitHub push用の認証情報が無い(credential helper未設定)ことが判明したため、
      家PC経由でファイルを取り込んでコミット・push(`e8f2395`)、その後VM側を
      `git reset --hard origin/main`で同期
    - VM上の家PC/ラップトップ双方に無関係な一時デバッグファイル(`checkNewSnap_tmp.ts`、
      7/18の別セッションの残骸)を削除
- 完了した状態：
  - `d86f912`(評議会バグ修正)・`e8f2395`(今週分データ)ともにGitHub・家PC・VM全て反映済み
  - VM側council-scheduler/audit-schedulerはPM2再起動済みで最新コードで稼働中、PM2
    4プロセスとも`online`
  - dev-config `.gitattributes`追加によりSSH鍵のCRLF破損は恒久的に解消(再発しない)
  - ラップトップは`git pull`(harvest-engine)+`sync-pull.ps1`(dev-config)のみで
    今日の状態に追いつける
- 残課題・次にやること：
  - **最優先(オーナー対応)**: Anthropicのクレジット決済が通り次第、候補3・4の判断評議会を
    VM上で再開する。選定結果は`council-output/selections/2026-07-20T06-01-55-358Z.json`に
    保存済みなので、生データ収集・選定をやり直す必要はなく、候補3・4だけをジャッジすればよい
    (今回使った再開用ワンオフスクリプトの構成は本セッションのやり取り参照、正式なnpm
    scriptとしては未整備)
  - 監査役の週次cronが今週発火しなかった原因は未特定。次回月曜(7/27)01:00 UTCに正常発火
    するか要確認。再発する場合はnode-cron v4の内部挙動を疑い、ポーリング方式への切替も検討
  - 決済失敗の根本原因(銀行の海外決済ブロックか、Anthropic/Stripe側の既知不具合か)は未確定。
    三井住友VISAへの問い合わせ結果待ち
  - VM側にGitHub push用の認証情報が無い状態が今回判明した。今後もVM上で直接コミットが
    発生する運用(監査証跡としてcouncil-output等をコミットする方針)を続けるなら、VM側にも
    push用の認証情報(PATやSSHデプロイキー等)を設定しておくと今回のような家PC経由の
    回避作業が不要になる(今回は急ぎではないため未対応、次回検討)
- 触ったファイル：`src/council/extractCandidates.ts`、`data/ledger.json`、
  `council-output/selections/2026-07-20T06-01-55-358Z.json`、
  `council-output/verdicts/`(候補1・2の裁定2件)、dev-config `.gitattributes`(新規)、
  dev-config内`envs/harvest-engine/data/tokens/*`・`envs/auto_x-app/data/tokens/*`
  (CRLF→LF修正)、VM側の一時ファイル`checkNewSnap_tmp.ts`(削除)

## harvest-engine-council-resume-themeJ-01（2026-07-23）
- 作業環境：ノートPC
- やったこと：
  - 前回セッション(家PC)の環境確認後、Anthropicクレジット決済が解決済みとの報告を受け、
    決済失敗で中断していた候補3「AIエージェント運用のガードレール」・候補4「広告体験の劣化と
    ダークパターン規制」の判断評議会を一時スクリプト(`runCouncilForTopic()`を直接呼ぶ、実行後
    削除)で再開。候補3は**採択**(約159円)、候補4は**保留**(約119円)、合計約278円を
    `data/ledger.json`に自動記帳
  - 候補3の調査プロンプトをオーナー承認の上CCへ投入し実地調査を実施。並列サブエージェント2本
    (海外・新興プレイヤー担当/日本語圏・個人開発者層担当)で14候補を発掘し、主要候補は本番
    `politeFetch`/`isAllowedByRobots`で実機再検証した
  - **重要な発見**: サブエージェントは見落としていたが、有力候補Medusa(GitHub、★947)の公式
    サイト(pantheonsecurity.io)のrobots.txtに`User-agent: ClaudeBot / Disallow: /`という
    Cloudflare管理ブロックが明示的に存在した(後段に矛盾するAllowもあるが名指しDisallow自体が
    存在するためCLAUDE.md「巡回対象選定の追加ルール」に抵触)。公式サイトを除外しGitHub
    リポジトリ側のみ監視対象とした
  - オーナー確認の上、テーマ適合・更新頻度に疑義のある2件(汎用エントロピー検出ツール
    「entropy」、Agensiの静的販売ページ)と日本語エンタープライズ向けTEE方式「Acompany」を
    backlogに回し、残り12件(RSS完備3件=Trestle/GMO Flatt Security Blog/yatta47個人ブログ、
    GitHub個人OSS 8件、公式サイト1件=agent-env)をテーマJとして第1層登録。`prisma/seed.ts`
    追記+一時スクリプト(`prisma/tmp-add-theme-j.ts`、実行後にローカル・VM双方から削除)による
    `createMany`のみでローカルdev.db・VM双方に反映
  - `CLAUDE.md`「現在の層の割り当て」にテーマJを追記。`会社説明資料.html`にテーマJのカードを
    平易な言葉で追加し、件数表記(情報源→125件・稼働→86件・テーマ数→8個)を更新
  - `HANDOFF.md`を更新(評議会再開・テーマJ調査結果・現在の稼働状況・オーナー判断待ち項目の
    解消)
- 完了した状態：
  - 2026-07-20選定分の4候補は全て判断済み(候補1保留・候補2却下・候補3採択・候補4保留)
  - sources合計**ローカル125件・VM125件で完全一致**(active86/inactive39、双方同一)
  - 累計支出36,869円(消化率18.4%、API費目残額11,131円)
  - 変更一式をコミット・push済み(`7e8c716`)
- 残課題・次にやること：
  - 監査役の週次cronが2026-07-20(月曜)に発火しなかった原因は未特定のまま。次回
    2026-07-27(月曜)01:00 UTCに正常発火するか要確認(次回セッションで必ず見ること)
  - backlogに回した「entropy」「Secret Leak Guard(Agensi)」「Acompany」は状況が変わった場合
    に再調査すればよい
  - テーマJはパーサー未実装(収集のみ、第1層)。今回追加した小規模GitHub OSS(★0のenv-guard・
    secrets-scanner等)は開発停止・放棄リスクが高く「消える前提」で監視している旨、留意すること
- 触ったファイル：`CLAUDE.md`、`HANDOFF.md`、`会社説明資料.html`、`prisma/seed.ts`、
  `data/ledger.json`、`council-output/verdicts/`(候補3・4の裁定2件)、
  `council-output/AIエージェント運用のガードレール(シークレット漏洩防止・権限-MCP検証).md`
  (調査プロンプト、新規)、ローカルDB・VM側(`161.33.148.155`)のsourcesテーブル
