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
