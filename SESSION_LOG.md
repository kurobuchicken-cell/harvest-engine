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
