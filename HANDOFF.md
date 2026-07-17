# HANDOFF

最終更新: 2026-07-17

## 今回変更したこと(何を・なぜ)

新規active化した5ソース(サイボウズ kintone/Office/Garoon/メールワイズのRSS、freeeのHTML)に
incidentsパーサーを実装した。既存のSlack/Notion/Zendeskと同じ設計(registry.tsで
companyName→アダプタのマップ、parseChange.tsがraw snapshotを読んでincidents化)を踏襲。

- `src/adapters/incidents/cybozuRss.ts`(新規): kintone/Office/Garoon/メールワイズ共通のRSSパーサー。
  実データでタイトル先頭の【復旧】【改修済】【対応完了】プレフィックス運用を確認し、これらを解決済み、
  プレフィックス無しを未解決として判定
- `src/adapters/incidents/hund.ts`(新規): Hund.io系ステータスページ汎用パーサー。ページ上部の
  `issue-notice--wrapper`(現在進行中の告知)を抽出。`freee`に登録、将来同プラットフォームの
  他社にも流用可能
- `src/adapters/incidents/registry.ts`: 5社分をマップに追加
- `src/adapters/incidents/types.ts`: `IncidentAdapter`の戻り値型に`Promise`を許容(RSSパース(rss-parser)が
  非同期のため)
- `src/adapters/incidents/parseChange.ts`: raw snapshotの読み込みを`source.fetchType`で分岐。
  `json`のみ`JSON.parse`、`rss`/`html`はテキストのままアダプタに渡すよう修正
  (既存実装はraw本文を常にJSON.parseしており、RSS/HTMLソースでは必ず例外になっていたバグ。
  Slack/Notion/Zendesk(すべてjson)の挙動は変更なし)

`npm run incidents:backfill`実行 → 5件のpending changesがすべて`parsed`、81件のincidents作成
(kintone/Office/Garoon/メールワイズ各20件、freee 1件)。`npm run diagnose`でも全active sourceの
snapshot正常を確認。

## 現在の稼働状況

- sources合計: 46件(active 24 / inactive 22)
- 内訳:
  - 保険20社(生保10・損保10): 一部403のため一部inactive
  - Statuspage.io系15件: active 3件(Slack/Notion/Zendesk)、inactive 12件
    (11件はrobots.txtの`/api`Disallow、Salesforceはサーバー側403)
  - テーマC(SaaS障害)追加10件: active 5件(kintone/Office/Garoon/メールワイズ/freee、今回パーサー実装対象)、
    inactive 5件(cybozu.com/SmartHR/マネーフォワードME・biz/Chatwork、いずれもPuppeteer未対応が理由)
- incidentsパーサー実装済み: Slack/Notion/Zendesk(既存)、kintone/Office/Garoon/メールワイズ/freee(今回)
- Oracle VM(161.33.148.155)上でPM2+systemd常駐運用中(詳細はSESSION_LOGのharvest-engine-oci-setup-01参照)

## 新たに判明した課題・次アクション

- `statuspage:sync`のスキーマ不一致(Slack/Notion/Zendeskが実レスポンスとincidents配列前提の
  アダプタが一致せず常に新規0件)は未対応のまま(既知の制約、今回はスコープ外)
- Puppeteer未対応のためinactiveのまま残っている10件(保険5社+cybozu.com/SmartHR/
  マネーフォワードME・biz/Chatwork)は引き続き未着手
- 住友生命(id=4)は既にIPブロックではなく恒常的な403と判断しactive=falseに変更済み(解消済み)
- kintone/Office/Garoon/メールワイズは同一ドメイン(cs.cybozu.co.jp)の同一RSSフォーマットのため、
  4件とも`parseCybozuRssIncidents`を共有(product別の分岐ロジックは不要と判断)
- freeeは`issue-notice--wrapper`(ページ上部の現在進行中の告知のみ)を抽出対象としており、
  過去の解決済み履歴(`section.history`)はパース対象外(Slack/Notion同様、現在アクティブな
  インシデントのみを扱う設計に合わせた)
