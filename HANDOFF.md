# HANDOFF

最終更新: 2026-07-18

## 今回変更したこと(何を・なぜ)

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

## 現在の稼働状況

- sources合計: **85件**(active 52 / inactive 33)。**ローカル・VM双方に反映済み**
- 内訳:
  - 保険20社(生保10・損保10): 一部403のため一部inactive
  - Statuspage.io系15件+テーマC追加10件: 既存のまま(active見込み計8件、詳細は前回HANDOFF参照)
  - **テーマF新規23件: active15 / inactive8**(inactive理由の内訳: JS SPA本文空4件、
    robots.txt明示Disallow1件、価格JS注入1件、bot対策403 1件、UA判定ブロック1件)
  - **テーマG新規16件: active14 / inactive2**(inactive2件はいずれもmeti.go.jpのWAF拒否)
- incidentsパーサー実装済み: Slack/Notion/Zendesk、kintone/Office/Garoon/メールワイズ/freee
  (F/Gは未実装、収集のみ)
- Oracle VM(161.33.148.155)上でPM2+systemd常駐運用中(`harvest-engine-scheduler`/
  `harvest-engine-web`)。外部公開: `https://saas-status.com/`。VM空きメモリは78Mi
  (available 443Mi、buff/cache込み)とタイトなため、F/G追加後の初回巡回で負荷を実測すること
- 経営体制: `GOVERNANCE.md`(組織・意思決定権限・3層運営規律)・`BUDGET.md`
  (年間予算20万円・支出台帳・PL計画3シナリオ)を新設。現時点で支出実績はゼロ

## 新たに判明した課題・次アクション

### ローカルDBとVM DBの不整合を発見(住友生命 id=4、今回のF/G作業とは無関係)
ローカルdev.dbは`active=true`、VMは`active=false`で食い違っていた。過去のHANDOFF記録
(「恒常的な403と判断しactive=false変更済み(解消済み)」)から見てVM側のfalseが正しい状態と
見られるが、ローカルdev.dbだけ未更新のまま残っていた。本番はVMのため実害はないが、次回
ノートPC作業時にローカルdev.dbをfalseへ揃えるか、ユーザーに確認すること(今回は未対応のまま
保留)

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
