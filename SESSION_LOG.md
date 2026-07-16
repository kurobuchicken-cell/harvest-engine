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
