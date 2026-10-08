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

## harvest-engine-ledger-aggregate-01（2026-07-24）
- 作業環境：家PC
- やったこと：
  - セッション開始時、家PCのローカルSESSION_LOG.mdが7/20時点のまま古く、GitHub上には
    ノートPCが7/23に押した2コミット(決済解決を受けた候補3・4の判断評議会再開、
    テーマJ第1層登録)が未pull状態だったと判明。git fetchで検出しpull、以後「環境比較の
    前に必ずgit fetch/pullする」旨をメモリに記録
  - 残務確認の結果、「ローカル・VMそれぞれ別ファイルのledger.jsonを合算して見る仕組み」
    (週次評議会コストがVM側にも記帳されるようになり、ローカル単独のledger:reportでは
    消化率が実態より過小に見えるリスク)を最優先と判断しオーナー承認を得て着手
  - `npm run ledger:sync`(新規、`src/ledgerSync.ts`)を実装。SSH
    (`tokens/harvest_engine_vm_key`、`ubuntu@161.33.148.155`)でVM側`data/ledger.json`を
    取得し`data/ledger.vm.json`にキャッシュ(git管理外)。`src/lib/ledger.ts`に
    `mergeEntries`(id基準で重複排除)・`readEntriesFrom`を追加し、`npm run ledger:report`を
    ローカル+VM合算集計に変更(VMキャッシュ未取得時はその旨明示、8日超過で再取得警告)
  - 動作確認: `ledger:sync`実行→VM11件取得→ローカル13件と合算し重複除去後13件・36,869円
    (消化率18.4%)で従来のローカル単独集計と一致することを確認(現時点でVM側記帳は全て
    ローカルに手動反映済みだったため差分なし)。VMキャッシュ削除時に「ローカルのみ」表示へ
    正しくフォールバックすることも確認。`tsc --noEmit`型エラーなし
  - `HANDOFF.md`を更新(ledger合算の実装内容、「次フェーズ」項目の解消)
- 完了した状態：
  - ローカル・VMのledger合算機能が完成、`npm run ledger:sync`→`npm run ledger:report`の
    2ステップで消化率を確認できる。ただし`ledger:sync`は手動実行が前提(自動化はしていない)
  - 現時点の合算後累計支出は36,869円(消化率18.4%)で変化なし(隠れていた支出はなかった)
- 残課題・次にやること：
  - `ledger:sync`の定期実行(自動cron化などは今回スコープ外、手動実行忘れに注意)
  - 監査役の週次cronが2026-07-27(月曜)01:00 UTCに正常発火するか要確認(引き続き未確認)
  - テーマCのフル出口法務ゲート「弁護士スポット相談」の実施タイミングはオーナー判断待ちのまま
- 触ったファイル：`src/ledgerSync.ts`(新規)、`src/lib/ledger.ts`、`src/ledgerReport.ts`、
  `package.json`、`.gitignore`、`HANDOFF.md`

## harvest-engine-audit-check-explain-01（2026-07-28）
- 作業環境：ノートPC
- やったこと：
  - 前回セッション(7/23)の残課題「監査役週次cronが2026-07-20に発火しなかった件、次回
    2026-07-27の発火確認」に対応。VM(`161.33.148.155`)にSSH接続しPM2ログ・council-scheduler
    ログ・ledger.jsonを確認したが、`auditScheduler.ts`はプロセス起動時にしかログを出さない
    設計のため発火有無をログだけでは判定できないと判明。オーナーに直接「2026-07-27朝の監査役
    Slack通知は届いたか」を確認したところ受信済みとの回答を得たため、解消と判断
  - 同じVM調査で、週次評議会パイプラインが2026-07-27 00:00 UTCに完全自動・無介入で正常実行
    されたことを確認(先週7/20はクラッシュして手動再実行が必要だった)。ただし選定評議会は
    生データ500件から候補0件と判断し、今週は新規テーマは生まれなかった(費用532円は正常に
    自動記帳済み)
  - オーナーから「会社が何をしているか人に説明できない、20万円投資して儲かるのか」との
    率直な指摘を受け、`会社説明資料.html`を更新。「30秒で分かる要約」ボックスを新設し、
    新セクション「儲けの見通し」(BUDGET.mdの3シナリオをそのまま掲載、手堅い/普通の2パターンは
    年間赤字である旨を隠さず明記)と「毎週の動き」(巡回→評議会→監査役の自動サイクル説明)を
    追加。進捗の数字も最新実績(37,123円・消化率18.6%)に更新
  - `HANDOFF.md`「オーナー判断待ち」の監査役cron項目を解消済みとして更新し、
    「auditScheduler.tsはログでは発火有無を判定できない」という設計上の注意点を明記
- 完了した状態：
  - 監査役週次cronの2週連続未発火は起きていないことを確認(単発事象と判断、原因自体は未特定)
  - sources合計125件(active86/inactive39)、累計支出37,123円(消化率18.6%)、いずれも
    前回セッションから変化なし
  - `会社説明資料.html`・`HANDOFF.md`の変更をコミット済み(`ca8fafd`)
- 残課題・次にやること：
  - `auditScheduler.ts`にcron発火時のログ出力が無い設計上のギャップは未修正のまま
    (今回はSlack通知の受信確認で代替した)。再発生時の切り分けを容易にするため、
    次回以降で発火時ログの追加を検討してもよい
  - API費目の消化率が77.3%(残額10,877円)まで進んでいる。選定評議会だけで毎週500円強
    かかる設計のため、候補0件の週が続いても残り20週分程度しか持たない計算。次回評議会
    実行前後に予算の扱いをオーナーと確認すること
  - ルートディレクトリに未追跡の`AGENTS.md`が存在(今回のセッションでは内容未確認・
    未着手のまま。次回セッションで扱いを確認すること)
- 触ったファイル：`HANDOFF.md`、`会社説明資料.html`

## harvest-engine-explore-phase-01（2026-07-29）
- 作業環境：ノートPC
- やったこと：
  - オーナーから承認済みの「自律探索フェーズ」設計たたき台を、Opusモデルで評議会相当の
    厳密さ(監査役視点=既存資産アンカリング・分野偏り検査を含む)で審査。web_search実費の
    記帳漏れ・予備費充当の会計処理不成立・サーキットブレーカーが事後判定でしか機能しない・
    効果測定の仕組み欠如の4点を修正指摘し、オーナー決裁(予備費20,000円→API費目へ全額振替、
    月間1,000円/年間10,000円上限)を得た上で確定
  - Sonnetに切り替えて実装。`src/council/exploreQueries.ts`(新規、探索フェーズ本体)、
    `pricing.ts`/`councilCore.ts`(web_search課金$10/1,000検索の記帳漏れ修正、既存2評議会にも
    自動適用)、`selectCandidates.ts`(固定フィード/探索由来を2セクション表示・監査役条件追加)、
    `run.ts`(パイプライン統合)、`ledgerReport.ts`(費目配分改定)を実装
  - `tsc --noEmit`型エラーなし。隔離環境(本番data/ledger.json非接触)で予算上限チェック5
    パターン・探索失敗時の継続1パターンを検証し、検証中に既存の`readAllEntries()`が
    ledger破損時に「支出ゼロ」と誤読する潜在バグを発見・回避(探索フェーズ専用の
    `readLedgerStrict()`で対応)
  - コミット・push後、VM側`data/ledger.json`が未コミットのまま分岐(2026-07-27/29の手動
    評議会実行分、実記帳6件)していたと判明。オーナー確認の上`mergeEntries()`で
    ローカル13件+VM6件→19件に統合し欠落なく解消。VM側で`git pull`(fast-forward)・
    `harvest-engine-council-scheduler`をpm2 restartして新コードを反映、エラーログなしを確認
  - `BUDGET.md`/`HANDOFF.md`/`DECISIONS.md`/`会社説明資料.html`を更新。本件は
    RULES.md上は評議会必須の意思決定だが、オーナー指示によりOpus単独審査で代替した
    経緯をDECISIONS.mdに記録
- 完了した状態：
  - 自律探索フェーズの実装・VMデプロイが完了。次回月曜(9:00 JST)の週次自動実行から
    有効になる(実際のOpus API呼び出しはまだ未実施、次回が初回)
  - ローカル・VMの`data/ledger.json`は19件で完全一致。API費目残額29,725円(予算68,000円)
  - sources件数・active/inactive内訳に変化なし(新規ソース追加なし)
- 残課題・次にやること：
  - **API費目は探索フェーズ抜きでも2027年1月頃に枯渇する見込み**(週次評議会実測874円/週+
    Perplexity年額33,000円)。週次評議会自体のコスト最適化(隔週化・effort見直し等)を
    オーナーと相談する必要あり(次回セッションの優先課題)
  - 探索フェーズの実効果測定はこれから。次回以降の週次実行で探索由来(`origin: "explore"`)の
    候補が実際に選定・採択されるかを2〜3ヶ月分蓄積してから評価する
  - ルートディレクトリの未追跡`AGENTS.md`は今回も内容未確認のまま(前回セッションから持ち越し)
  - テーマCのフル出口法務ゲート「弁護士スポット相談」の実施タイミングはオーナー判断待ちのまま
- 触ったファイル：`src/council/exploreQueries.ts`(新規)、`src/council/pricing.ts`、
  `src/council/councilCore.ts`、`src/council/selectCandidates.ts`、`src/council/runCouncil.ts`、
  `src/council/run.ts`、`src/council/types.ts`、`src/ledgerReport.ts`、`data/ledger.json`、
  `BUDGET.md`、`HANDOFF.md`、`DECISIONS.md`、`会社説明資料.html`

## harvest-engine-ledger-credit-check-01（2026-08-03）
- 作業環境：ノートPC
- やったこと：
  - オーナーから「Anthropic APIの残高がマイナスになっていた、$110追加チャージした、
    経理に報告する」との報告を受け対応
  - `npm run ledger:sync`でVM側ledgerを同期し、直近の週次パイプライン(今日8/3 09:00〜09:25
    JST)が正常終了していることを確認。7/29実装の自律探索フェーズが初めて実際にAPI呼び出しを
    行い(発見4件・86円)、選定評議会(候補3件・307円)→判断評議会3件(採択1件・保留2件・454円)
    まで全件正常記帳されており、エラー・記帳漏れの形跡なし。残高マイナスは処理失敗ではなく
    通常消化ペースがクレジットを使い切ったタイミングと判断
  - Anthropicクレジット追加購入$110を一時スクリプト(`src/tmpRecordAnthropicCredit.ts`、
    実行後削除)経由で`appendExpense()`により記帳(17,382円、実勢レート158.02円/ドル)
  - 記帳後の集計でAPI費目残額が11,496円(消化率83.1%、残20%割れ)となり、BUDGET.md
    「残20%未満で執行役がHANDOFF.mdに警報を記載する」ルールに該当したためHANDOFF.mdに
    警報エントリを追記
  - コミット・push済み(`92dae96`)
- 完了した状態：
  - 累計支出56,504円(消化率28.3%)。API費目残額11,496円(消化率83.1%、警戒ライン⚠️)
  - sources件数・active/inactive内訳に変化なし(125件、active86/inactive39)
  - HANDOFF.mdに次回優先課題として「週次評議会のコスト最適化(隔週化・effort見直し)を
    オーナーと相談」を明記済み
- 残課題・次にやること：
  - **最優先**: 週次評議会のコスト最適化(隔週化・Opus effort設定見直し等)をオーナーと相談
  - ルートディレクトリの未追跡`AGENTS.md`は今回も内容未確認のまま(前々回セッションから持ち越し)
  - テーマCのフル出口法務ゲート「弁護士スポット相談」の実施タイミングはオーナー判断待ちのまま
- 触ったファイル：`data/ledger.json`、`HANDOFF.md`

## harvest-engine-vm-catchup-and-onboard-01（2026-08-25）
- 作業環境：ノートPC
- やったこと：
  - オーナーの「最近プロジェクト増えてる?」という質問をきっかけに調査した結果、
    2026-08-03〜08-24の週次評議会実行(4回分)がVM上で正常稼働し続けていたにも
    かかわらず、GMが3週間一度も点検しておらずGitHubに未反映だったことが判明
  - VM側の未push分をSSH経由でローカルにfetch・マージしてGitHubへpush、VMも同期
  - 評議会のシステムプロンプトにAnthropicプロンプトキャッシュが未実装だったコード
    不備を発見・修正(`src/council/councilCore.ts`)
  - API費目残額が警戒ラインを割ったため、需要テストから5万円をAPI費目へ振替
    (オーナー決裁、需要テスト80,000→30,000円、API 68,000→118,000円)
  - 滞留していた採択済み候補6件を並列サブエージェント3本で実地調査し、5件を
    テーマK〜O(建設業DX・パーセル運賃・標準的運賃・FDAリコール・省庁横断リコール)
    として第1層登録。India fintech(RBI)はrobots.txt判定不能のため見送り
  - 再発防止の根本対策として、VM側にGitHub Fine-grained PAT(Contents:read-writeのみ)
    を設定し、週次パイプライン完了時に自動commit・pushする仕組み(`src/lib/gitSync.ts`)
    を実装。push認証・権限をdry-runで実地確認済み
- 完了した状態：
  - sources合計144件(active103件)、ローカル・VM完全一致
  - 累計支出59,280円(消化率29.6%)、API費目残額58,720円(消化率50.2%、警戒ライン脱出)
  - CLAUDE.md・BUDGET.md・DECISIONS.md・HANDOFF.md・会社説明資料.htmlすべて最新化済み
  - 自動push機構がVM上で稼働中(次回8/31週の実行で実データでの動作を初検証)
- 残課題・次にやること：
  - **最優先**: 次回セッション開始時に必ず`npm run ledger:sync`でVM状態を確認する運用を
    定着させる(今回の3週間見落としの再発防止)。あわせて自動push機構が実際に機能したか確認
  - GitHub PAT(`harvest-engine-vm-push`)の有効期限は2026-11-23。期限切れ前に再発行が必要
  - India fintech(RBI)のrobots.txt判定不能問題(WAFが`/robots.txt`のみ418ブロック)は未解決
  - 週次評議会のコスト最適化(隔週化・effort見直し)の相談は依然として持ち越し
  - ルートディレクトリの未追跡`AGENTS.md`は今回も内容未確認のまま
- 触ったファイル：`data/ledger.json`、`council-output/`(3週間分のVM実行結果)、
  `src/council/councilCore.ts`、`src/council/run.ts`、`src/lib/gitSync.ts`（新規）、
  `src/ledgerReport.ts`、`prisma/seed.ts`、`CLAUDE.md`、`BUDGET.md`、`DECISIONS.md`、
  `HANDOFF.md`、`会社説明資料.html`、VM側`.env`（GITHUB_PAT追加）・sourcesテーブル

## harvest-engine-strategy-pivot-01（2026-10-05）
- 作業環境：家PC
- やったこと：オーナーの「いつマネタイズするのか・情報収集しているだけ」の指摘を受け、支出実態(63,647円、売上0円)とVMデータ実態(変更4,503件の大半がノイズ)を確認。事業モデルを「出口工場」(一次情報収集→AI構造化→日英ページ自動生成→アフィリエイト/広告の薄利多売)に転換し、週次評議会の探索・選定・判断対象を「出口工場のジャンル」に変更
- 完了した状態：評議会プロンプト5ファイル変更(tsc通過)、DECISIONS.md・CLAUDE.md・HANDOFF.md・会社説明資料.html更新。VMへ反映済み。その過程でVM自動push(gitSync)が8/31以降毎週non-fast-forwardで失敗し6回分(採択9件)が滞留、かつ失敗時エラーにGitHub PATがbase64で含まれpm2ログに平文で残っていたことを発見。滞留分をローカル中継でマージ・push、gitSync.tsを修正(認証は環境変数経由・エラーマスク・push前rebase)、VMのpm2ログをflush
- 残課題・次にやること：PAT harvest-engine-vm-push は再発行・VM .env差し替え・push認証確認まで完了(新期限2027-01-03)。10/12の週次実行で新プロンプトと修正後gitSyncを検証。旧基準で採択された滞留9件を出口工場基準で再評価。パイロット3本を1セッション1本ずつ実装(国内・補助金[jGrants API+J-Net21 RSS]を先行、海外・ガチャ[日英仏]、国内・値上げ情報)。PAT期限2027-01-03
- 追加の決定：海外は最初から多言語前提(仏など欧州も候補)、国内向けジャンルも評議会で並行探索。Perplexity連携は一次情報源調査の自動化時に品質比較してから判断
- 触ったファイル：src/council/{councilCore,exploreQueries,selectCandidates,runCouncil,generatePrompt}.ts、src/lib/gitSync.ts、DECISIONS.md、CLAUDE.md、HANDOFF.md、会社説明資料.html、SESSION_LOG.md

## harvest-engine-pilot-subsidy-01（2026-10-05）
- 作業環境：家PC
- やったこと：出口工場の国内パイロット1本目「補助金」(テーマP)を実装。jGrants公開API+J-Net21 RSSを収集→J-Net21のみHaiku 4.5で分類→業種×地域×目的の静的HTMLをローカル生成
- 完了した状態：`npm run pilot:subsidy`で受付中338件(jGrants)+64件(J-Net21)から820ページを`site/subsidy/`に生成(掲載397件)。リンク切れ0・出典欠落0・J-Net21本文の転載0を確認、Edgeヘッドレスで表示確認済み。AI分類費は2回で計16円(ledger記帳済み)。J-Net21は利用規約で転載禁止のため本文を出さない設計。和暦の誤換算・融資の誤判定・jGrantsの毎回再取得の3件を実装中に発見・修正
- 追加：VMにpull・手動で1回実行し成功(826ページ、AI分類約8円、VM側ledgerは未コミットで10/12のgitSyncでpush想定)
- 追加2：jGrants Web-API利用規約の原文(PDF)を確認。商用利用可・出典「出典：Jグランツ」・加工した旨の記載が必須と判明し、全ページのフッターに加工表示を追加
- 残課題・次にやること：公開先・方法と加工表示の作成者名の決定(オーナー承認)、VMでの定期実行とVMのsourcesへの登録、目的を大量列挙した案件の扱い、次のパイロット(海外・ガチャ[日英仏]または国内・値上げ)。10/12の週次評議会で新プロンプトとgitSync修正を検証
- 触ったファイル：src/pilots/subsidy/*（新規）、仕様書_harvest-engine.html（新規）、package.json、.gitignore、prisma/seed.ts、CLAUDE.md、DECISIONS.md、HANDOFF.md、会社説明資料.html、data/ledger.json

## harvest-engine-pilot-gacha-01（2026-10-05）
- 作業環境：家PC
- やったこと：出口工場の海外向けパイロット1本目「ガチャ新作」(テーマQ、日英仏)を実装。バンダイ・タカラトミーアーツ公式の発売予定を収集→Sonnet 5.5で翻訳・作品名付与→言語別の月/メーカー/作品別ページをローカル生成
- 完了した状態：`npm run pilot:gacha`で402件から619ページを`site/gacha/{ja,en,fr}/`に生成。リンク切れ0・画像0・出典欠落0・hreflang欠落0を確認、Edgeで表示確認。Haikuは作品名の誤り(実在しない作品名)が出たためSonnet 5.5に切り替え(DECISIONS.md)。AI費用計140円(ledger記帳済み)。画像・説明文は規約上掲載しない
- 残課題・次にやること：オーナー指示で保持する将来実装＝商品画像・中小メーカー追加。ほか公開先・方法、VM反映と定期実行、ローマ字表記の品質、日本語ページの作品名の日本語化。次は国内・値上げ情報パイロット
- 触ったファイル：src/pilots/gacha/*（新規）、package.json、prisma/seed.ts、仕様書_harvest-engine.html、CLAUDE.md、DECISIONS.md、HANDOFF.md、会社説明資料.html、data/ledger.json

## harvest-engine-pilot-price-01（2026-10-05）
- 作業環境：家PC
- やったこと：出口工場の国内パイロット2本目「値上げ情報」(テーマR)を実装。31社を調査し21社を採用、ニュースリリース一覧のリンク文言で価格改定告知を拾う共通方式→本文/添付PDFをHaiku 4.5で構造化→実施日順・月別・メーカー別・品目別ページをローカル生成
- 完了した状態：`npm run pilot:price`で101件の告知を抽出(エラー0)、76ページ・掲載96件を`site/price/`に生成。リンク切れ0・出典欠落0、Edgeで表示確認。添付PDFのみの社・JSでPDF転送する社・本文に発表日が無い社に対応。AI費用105円(ledger記帳済み)
- 追加：オーナーがGM判断に委ねたため、politeFetch本体に取得60秒・robots.txt 15秒のタイムアウトを追加(既存リトライに乗る)。本番巡回にも効く修正のためVMへ反映(8fbb3f4までpull、scheduler・council-schedulerを再起動しonline確認)。VM側に未コミットで残っていた補助金のAI費8円は手元のledgerへ取り込みpushし、全環境のledgerを一致させた
- 残課題・次にやること：backlog10社の再調査、ブランド別ページ、3パイロットの公開先・方法の決定、VM反映と定期実行。旧基準の滞留採択9件の再評価、10/12週次評議会の検証
- 触ったファイル：src/pilots/price/*（新規）、package.json、prisma/seed.ts、仕様書_harvest-engine.html、CLAUDE.md、DECISIONS.md、HANDOFF.md、会社説明資料.html、data/ledger.json

## harvest-engine-factory-01（2026-10-05）
- 作業環境：家PC
- やったこと：パイロット3本(補助金・ガチャ・値上げ)の共通部を`src/factory/`に統合(型3種: catalog/announcement/api)し、毎日04:00 JSTの定期実行と自動点検(収集急減・リンク切れ・出典欠落・0件ページ・AI費用上限)+異常時Slack通知を追加。オーナー決定: JSONのまま/既存Slack異常時のみ/毎日04:00/1回100円・月1,500円
- 完了した状態：統合前後で全1,514ページがバイト一致。VM反映済み(8fd9c27、pm2に`harvest-engine-factory-scheduler`を追加しpm2 save、手元の保存データをscpでコピー)、VMで1回手動実行し3ジャンルとも異常0・約2分。Slackテスト通知送信済み。初回定期実行は10/6 04:00 JST
- 残課題・次にやること：10/6朝の定期実行結果をVMの`logs/factory-scheduler-out.log`と`data/factory/runs.json`で確認。J-Net21のRSS件数の変動による急減誤検知の監視。VM空きメモリ(実行中最小約81MB)の観察。公開先の決定(オーナー)、一次情報源調査の自動化(HANDOFF次アクション5)、10/12週次評議会の検証
- 触ったファイル：src/factory/*（新規）、src/factoryScheduler.ts（新規）、src/pilots/*/genre.ts（新規）、src/pilots/*（共通部へ移行、run.ts・store.ts・price/fetchUtil.tsは削除/移動）、src/lib/ledger.ts、package.json、ecosystem.config.js、.gitignore、仕様書_harvest-engine.html（4章）、DECISIONS.md、HANDOFF.md、会社説明資料.html、data/ledger.json

## harvest-engine-continue-01（2026-10-06）
- 作業環境：ノートPC
- やったこと：sync-pull.ps1をPS5.1で動くよう修正(dev-config)、10/6 04:00の出口工場初回定期実行の確認(3ジャンルとも異常0)、旧基準の滞留採択9件を再評価(新規採択0件・テーマOへ統合1件・保留1件)、一次情報源調査の自動化`research:sources`をClaude版で実装(手動起動)
- 完了した状態：`npm run research:sources -- <裁定JSON|"ジャンル名">`と`--recheck`が動作。リコール追跡でテストし登録候補5件・要確認5件(council-output/source-research/)。規約判定はHaikuで誤りが出たためSonnet 5.5に。開発・テスト費182円記帳済み(累計64,099円)。滞留9件の再評価はコミット・push済み(ec5d356)、dev-configもpush済み(b37690f)
- 残課題・次にやること：research:sources一式はコミット済み(09571c4、package-lock.jsonは除外し未コミットのまま)。次セッションは公開先・公開方法の判断材料の整理(harvest-engine-publish-plan-01)。手動調査3回または2026-11-02で自動連結の可否をオーナーに聞く(HANDOFF次アクション5)。テーマOのsources追加は規約原文確認後。10/12週次評議会の新基準検証。Perplexity比較はAPIクレジット確認待ち
- 触ったファイル：C:\dev\dev-config\sync-pull.ps1、src/research/*（新規）、package.json、仕様書_harvest-engine.html(5章)、DECISIONS.md、HANDOFF.md、会社説明資料.html、data/ledger.json、council-output/source-research/（新規）

## harvest-engine-publish-plan-01（2026-10-06）
- 作業環境：ノートPC
- やったこと：出口工場パイロット3本の公開判断材料を調査・作成(公開先比較・公開順・法務ゲート・広告/アフィリエイト候補・オーナー決定事項)。実装・公開・支出なし
- 完了した状態：`公開判断材料.html`を作成。調査中に規約確認漏れ3件を発見しHANDOFFに記録: バンダイが自動取得・AI二次利用を禁止(VMは毎日取得中)、J-Net21が商業目的利用を禁止、値上げR数社に営利利用制限。GM推奨は公開順P(jGrantsのみ)→R→Q、Cloudflare Pages+新規.com 1つ、広告なし公開=第2.5層・広告付き=第3層
- 残課題・次にやること：収集済みデータ(バンダイ・J-Net21)の削除可否、値上げ7社の規約原文確認、既存第1層テーマの規約見直し、5章の残りの決定事項。その後、補助金P公開版の準備(J-Net21除外・運営者ページ・sitemap・canonical・hreflang絶対URL化・薄いページnoindex)・VMからのデプロイ方法検証
- 追記：オーナー決定でバンダイ・J-Net21・値上げR 5社の収集・AI処理・掲載を停止しVM反映。収集済みデータは保持(削除可否は未決)
- 触ったファイル：公開判断材料.html(新規)、HANDOFF.md、SESSION_LOG.md、DECISIONS.md、CLAUDE.md、仕様書_harvest-engine.html、src/pilots/gacha/{genre,generate,languages}.ts、src/pilots/subsidy/{genre,generate}.ts、src/pilots/price/{sources,genre,generate}.ts

## harvest-engine-publish-plan-02（2026-10-07）
- 作業環境：ノートPC
- やったこと：停止後初の04:00定期実行を確認(3ジャンルとも停止対象へのアクセスなし・異常0)。オーナー承認でバンダイ・J-Net21の収集済みデータを削除、VMの消し忘れスクリプトcheckThemes.mjs(2026-08-25作成・参照なし)を削除、CLAUDE.mdの値上げR社数を16社に修正
- 完了した状態：VM・手元の items.json からバンダイ334件・J-Net21 75件、VMバックアップからJ-Net21 64件を削除し残存0を確認。削除後のVM生成はガチャ127ページ/70件・補助金773ページ/329件(締切切れの減少)で異常0
- 追記：オーナー決定(B)で第1層のうちC・H以外のactive 70件を規約見直しまで一時停止(VMのDBでactive=false、一覧はdata/paused-sources-2026-10-07.json)
- 残課題・次にやること：値上げ7社の規約原文確認、停止中70件の規約見直しと個別再開、公開判断材料5章の残りの決定事項(層の解釈・ドメイン・作成者名・弁護士相談・アフィリエイト)
- 触ったファイル：CLAUDE.md、HANDOFF.md、DECISIONS.md、SESSION_LOG.md、data/paused-sources-2026-10-07.json(新規)、VM側 data/pilots/*/items*.json・checkThemes.mjs・sourcesテーブル(git管理外)
- 追記2：補助金Pの第2.5層昇格・ドメイン取得をいったん承認→オーナーの指摘(競合・流入仮説なし)で保留。出口工場の勝算の見直しと対案のたたき台作成へ
- 追記3：出口工場の勝算を見直し(`勝算の見直し.html`)。オーナー承認で出口工場をNG判定、対案A(Apify Storeでのデータ販売)は需要確認(官公庁データ系59本がほぼ累計1〜2人・30日0〜1人)でNG。新しく作る前の必須条件(3つの問い・事前の判定基準・規約原文)をCLAUDE.mdに追加。会社説明資料に10/6〜7を追記。次はモデル自体を評議会で見直す。週次評議会はオーナー判断で停止(VM pm2 stop+save)
- 追記4：モデル見直しの論点(勝算の見直し.html 5章: 素材・電子書籍のマーケットもAI生成を制限)を提示→オーナー「どれもしっくりこない」→白紙から見直す方針。オーナーのイメージ「1時間に数円がずっと積み上がる」から「収穫機」の判定基準の仮説=公開60日で1時間平均1円を合意。次セッション harvest-engine-model-review-01 のプロンプトをSESSION_HANDOFF.mdに作成
- 触ったファイル(本エントリ全体)：上記に加え、勝算の見直し.html(新規)、会社説明資料.html、SESSION_HANDOFF.md、VMの週次評議会プロセス(pm2 stop)
- 追記5：終了後、オーナーが「流行りものを対象別に中学生でもわかる形で解説する」案を提示。参考のX記事(中学生でもわかるGit、16.2万表示)を分析し、次セッションの最初の検討候補としてSESSION_HANDOFF.mdに追記
- 追記6：オーナーから「例をなぞって終わらせるな、考え方を共有している」と指摘。考え方(理解が追いつかない瞬間×専門用語の翻訳)・仮説(生まれた直後の空白に先回り)・3段階(小中高)×情報の成熟に合わせて深くする形をSESSION_HANDOFF.mdに整理

## harvest-engine-model-review-01（2026-10-07）
- 作業環境：ノートPC
- やったこと：収穫機モデルの白紙見直し。検索流入型「わかりやすい解説」コンテンツを5テーマ(制度変更・新NISA・AI業務導入・世界史×ニュース・ニュース速報解説)で実地検証し、全て既存の強い先行者(士業・金融機関・SaaS企業・有名人)に占有されていてNG。開発者向けニッチAPI(利用料モデル)にIndieHackersの実例(月収$9,000〜11,000)を発見し、次回優先の検証候補とした
- 完了した状態：HANDOFF.mdに本日の検証結果と次アクションを記録済み。コード変更・支出なし、方針検討のみ。オーナーから「なぜ制度変更を選んだ・需要あると思うか」「多くの人が知りたいテーマでなければ話にならない」という指摘を受け、需要の大きさを先に実証してから競合を見る順番に修正した
- 残課題・次にやること：次セッション(harvest-engine-model-review-02想定)で、開発者向けニッチAPIの具体的候補を2〜3個出し、検索結果の層・既存競合の厚さを実地確認する。候補を作る前にCLAUDE.mdの「新しいジャンル・商品を作る前の必須条件」を満たすこと。値上げ7社の規約原文確認・停止中70件の扱いも残課題のまま
- 触ったファイル：HANDOFF.md
- 追記(2026-10-08)：オーナー指摘「技術畑出身じゃないけど大丈夫か」「またAPIに縛られている」を受け、勝ち筋の構造(人が集まりお金を払う場所×その場所の中で見つけてもらう×大手が放置する狭い需要)をIT以外にも当てはめて確認。LINEスタンプ・Etsy・BOOTH・NotionテンプレートはいずれもAI生成で埋まるか締め出されておりNG。道具の利用料は「まだ否定されていない唯一の方向」であり勝ち筋とは言えないため、次セッションは成功例しか見ていない問題・Apifyとの矛盾・作り手の困りごと問題で否定を試みる形にSESSION_HANDOFF.mdを書き換えた

## harvest-engine-model-review-02（2026-10-08）
- 作業環境：ノートPC
- やったこと：「道具の利用料」を0円で否定検証しNG(各マーケットの利用者分布・Apify上位の中身・困りごと探し)。オーナー提案でインバウンドの困りごとを8回試行し全NG(国が全関係者に無料で情報提供、行動の代行は投資を受けた会社が埋める)
- 完了した状態：勝算の見直し.htmlに6章(10/7夜〜10/8の検証記録)を追記、HANDOFF.mdを更新。コード変更・支出なし。次の探し方を「国が力を入れていない×細かくばらばらに変わり続ける×その変化でお金が動く人がいる」とオーナー合意
- 残課題・次にやること：上記の基準で分野を問わず仮説→0円検証を繰り返す。値上げ7社の規約原文確認・停止中70件の扱いは未着手
- 触ったファイル：勝算の見直し.html、HANDOFF.md、SESSION_LOG.md
- 追記(同日・続き)：分野を問わず約12回試行(開業クリニック・入札・商標・ショートステイ・設備部品EOL・キャンセル待ち見張り・農業委員会議事録・クマ・絶景予報など)し全NG、勝てない理由を5つの壁に集約。オーナーの困りごと(トイレの長居)はバカンが事業化済みと判明。App Store売上上位2,195本の分析で個人開発が勝てる3型(A記録帳・B推し活・C公開データ×趣味)を発見、オーナー「ABCぜんぶおもろそう」で次セッションへ。オーナーからの指摘「方向転換はオーナーの判断を取る(続けるかどうかは聞かない)」を記憶に保存。勝算の見直し.html 6-5・HANDOFF.md・SESSION_HANDOFF.mdを更新

## harvest-engine-model-review-03（2026-10-08）
- 作業環境：ノートPC
- やったこと：個人開発3型(A記録帳・B推し活・C公開データ×趣味)の約20分野で空きを探し(ウェブ検索+App Store個別ページ約15件。itunesの一括検索はオーナー不承認)、メダカ繁殖記録アプリ(テーマS)をオーナー承認で採択
- 完了した状態：判定基準を合意(公開60日で手取り1,440円、手数料15%控除後。DL数・利用者数も記録)。Apple年99ドル・Small Business 15%・Expo EASの無料枠を公式で確認。DECISIONS/CLAUDE(層の割り当てにS)/HANDOFF/勝算の見直し6-6/会社説明資料を更新。C:\dev\medaka-log\仕様書_medaka-log.html を新規作成(機能は仮案、Perplexity用の質問文6問つき)。支出・コード変更なし
- 残課題・次にやること：オーナーがPerplexityで当事者の声を集める→機能確定→Expoで実装。WindowsからEASで提出できるかの確認、medaka-logのgit/GitHub作成(オーナー確認後)。値上げ7社の規約原文・停止70件の扱いは未着手
- 触ったファイル：DECISIONS.md、CLAUDE.md、HANDOFF.md、勝算の見直し.html、会社説明資料.html、SESSION_LOG.md、C:\dev\medaka-log\仕様書_medaka-log.html
- 追記(同日・続き)：オーナーのPerplexity調査(6問)でメダカ記録アプリが2026年に6本既出と判明→S をNG、6つ目の壁「当事者が自分で作る」を追加。型Cを「当事者が作りにくい(毎日の更新が要る)」で掘り、峠の開通通知+走った峠の記録(テーマT)を採択(Perplexity峠1〜4・長野/新潟/群馬の規約原文・JARTIC FAQ・Expo push無料を確認)。オーナー方針「ワンストップで解決」「エンジンと皮を分けて台数を増やす」を記憶に保存。C:\dev\toge-log\仕様書_toge-log.html を新規作成。次は情報源(都道府県・国道事務所)の洗い出しと1県ずつの規約原文確認
- 追記(同日・終了時)：テーマTの情報源の洗い出し第1回(北海道・東北・関東甲信越・北陸の一部・鳥取・奈良。建設事務所単位・PDF中心で100ページ超の見込み)と規約の一次確認を仕様書4-1・4-2に記録。オーナー指示でセッション分割、次は harvest-engine-toge-sources-01(SESSION_HANDOFF.mdを作り直し)

## harvest-engine-toge-sources-01（2026-10-08）
- 作業環境：ノートPC
- やったこと：テーマT(峠の開通通知)の未確認地域の発表場所を調査し、27道府県と国(国交省・北陸地整・北海道開発局)のサイトポリシー原文を確認。情報源一覧ファイルを作成
- 完了した状態：自動取得・AI利用の禁止条項はすべて記載なし(北海道CC BY、岡山・国はPDL1.0)。トップ以外へのリンクに問い合わせが要る発行元が12あり、オーナー決定で「条件ごとに張り分ける」。一覧は src/pilots/toge/sources.ts(発行元32・発表ページ25、オーナー決定でRと同じ形)。見張る価値は東日本(北海道・東北・関東甲信越・北陸・岐阜)に集中。仕様書4章・HANDOFFを更新。支出なし
- 残課題・次にやること：事務所単位の発表ページの残りを特定して追加(100ページ超の見込み)、奈良(証明書切れ)・いの町・douro.comの規約確認、エンジンとアプリの設計。値上げ7社の規約原文・停止70件の扱いは未着手
- 触ったファイル：src/pilots/toge/sources.ts(新規)、HANDOFF.md、SESSION_LOG.md、C:\dev\toge-log\仕様書_toge-log.html
