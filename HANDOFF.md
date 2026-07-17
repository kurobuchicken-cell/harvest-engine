# HANDOFF

最終更新: 2026-07-17

## 今回変更したこと(何を・なぜ)

### C公開ページ(src/web/)をsaas-status.comとして外部公開
- 既存のOracle VM(161.33.148.155、schedulerが常駐中)に`harvest-engine-web`(PM2)を追加デプロイ。
  ローカルPCでの公開は行わず、既にPM2+systemd常駐実績のあるVMに一本化する方針とした
- 外部公開はCloudflare Tunnel(cloudflared)経由。ポート開放・OCI Security List変更は不要。
  VM上にcloudflaredをsystemdサービスとしてインストール(`cloudflared service install <token>`)、
  Tunnel名`harvest-engine-web`のPublished application routeで`saas-status.com → http://localhost:3000`を設定
- `src/web/server.ts`に`/robots.txt`・`/sitemap.xml`を追加(このサイト自身はクロールされたい側のため
  `Allow: /`。harvest-engine本体が収集先に対して守るrobots.txtとは逆の立場である点に注意)。
  ベースURL`https://saas-status.com`はコード直書き
- ハマった点: Tunnel作成ウィザードの「Route Traffic」画面を未入力のまま離脱すると、DNSのCNAME
  レコードだけ残ってTunnel側のingress設定(公開ホスト名→localhost:3000の転送)が空のままになり、
  `cloudflared`が全リクエストに503を返す状態になった。DNSレコードを一度削除し、Tunnelの
  「Published application routes」から改めてホスト名+転送先を同時に作成して解消

### VM側DBの欠落データを復元
- 原因: Oracle VMへのDB移行(scp)を行ったタイミングが、テーマC10ソース(サイボウズ4製品/cybozu.com/
  freee/SmartHR/マネーフォワードME・biz/Chatwork)追加コミット(`335e168`)より前だった。
  そのためVM側`sources`テーブルにこの10件が丸ごと存在せず、副次的にVM側schedulerは
  これら5社(active分)を一度も巡回できていなかった
- 対応1: VMの`sources`に該当10件を`createMany`のみで追記(既存36件は無傷、IDもローカルと
  一致する37-46で採番された)
- 対応2: ローカルの81件のincidents(2024-03-25〜)を、`sourceChangeId`をNULLにしてVMへ直接
  `createMany`で移植(元のraw snapshot/changeがVMに存在しないためFK維持は不可能と判断)。
  DBファイル丸ごと置き換えは不採用(VM移行後にVM自身が独自収集した保険・Statuspage系のsnapshot/
  changeを消失させるため)
- 対応3: 出典リンクに必要な`source_url`列が、以前のセッションで実装済みだったが未コミットのまま
  残っていた(`prisma/schema.prisma`+`prisma/migrations/20260717044709_add_incident_source_url/`)。
  今回コミットし、VM側に`prisma migrate deploy`+`prisma generate`+PM2再起動で反映

## 現在の稼働状況

- sources合計: 46件(active 24 / inactive 22)。ローカル・VMのIDは完全一致
- 内訳:
  - 保険20社(生保10・損保10): 一部403のため一部inactive
  - Statuspage.io系15件: active 3件(Slack/Notion/Zendesk)、inactive 12件
    (11件はrobots.txtの`/api`Disallow、Salesforceはサーバー側403)
  - テーマC(SaaS障害)追加10件: active 5件(kintone/Office/Garoon/メールワイズ/freee)、
    inactive 5件(cybozu.com/SmartHR/マネーフォワードME・biz/Chatwork、いずれもPuppeteer未対応が理由)
- incidentsパーサー実装済み: Slack/Notion/Zendesk、kintone/Office/Garoon/メールワイズ/freee
- Oracle VM(161.33.148.155)上でPM2+systemd常駐運用中。`harvest-engine-scheduler`と
  `harvest-engine-web`の2プロセス構成(同一PM2デーモン、`pm2 save`済みでVM再起動時に両方自動復元)
- 外部公開: `https://saas-status.com/`(Cloudflare Tunnel経由、Proxied)。robots.txt/sitemap.xml稼働確認済み
- VM incidentsは81件(ローカルと同数、2024-03-25〜2026-07-09)。出典リンク表示も確認済み

## 新たに判明した課題・次アクション

- `statuspage:sync`のスキーマ不一致(Slack/Notion/Zendeskが実レスポンスとincidents配列前提の
  アダプタが一致せず常に新規0件)は未対応のまま(既知の制約)
- Puppeteer未対応のためinactiveのまま残っている10件(保険5社+cybozu.com/SmartHR/
  マネーフォワードME・biz/Chatwork)は引き続き未着手
- 住友生命(id=4)は既にIPブロックではなく恒常的な403と判断しactive=falseに変更済み(解消済み)
- kintone/Office/Garoon/メールワイズは同一ドメイン(cs.cybozu.co.jp)の同一RSSフォーマットのため、
  4件とも`parseCybozuRssIncidents`を共有(product別の分岐ロジックは不要と判断)
- freeeは`issue-notice--wrapper`(ページ上部の現在進行中の告知のみ)を抽出対象としており、
  過去の解決済み履歴(`section.history`)はパース対象外(Slack/Notion同様、現在アクティブな
  インシデントのみを扱う設計に合わせた)
- **運用上の教訓**: ローカルでの変更(sources追加・スキーマ変更等)は、コードをgit pushしただけでは
  VM側DBに反映されない(sources行やマイグレーションはDBの状態そのものであり、コードのpullとは別工程)。
  今後ローカルでsourcesやDBスキーマを変更した場合は、VM側にも同じ変更(seed追記・migrate deploy等)を
  適用したかを都度確認すること
- 今後Puppeteer対応や新規source追加を行う際は、ローカル・VM双方のDB状態を都度突き合わせる
  (今回のような欠落は`sourceCount`/`incidentCount`等の簡単な件数比較で検知できる)
