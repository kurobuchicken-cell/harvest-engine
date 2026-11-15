# idea-390 精査(2026-11-15)
深さ: 標準(案1件・答えは項目ごと。Perplexity は使っていない)

## 型
注文(1型紙ごとに作る)・AI製(検算はプログラム)・海外(英語圏の個人デザイナー)・他言語(英語の型紙を読む)・損は当たらない(誤りは相手の損害だが「下見」と明示すれば軽い)。売り場に出すなら売場・アプリは別途、自店(Payhip+Stripe)なら自店。素材・補助・調達・請求・専門・子は当たらない。

## 判定: 調べきれない(捨てる寄り)
- 案の記録の前提「検算専用の道具は無い」は誤り。同じ仕組み(AIは文を読むだけ、数えるのはコード)の無料の公開品 StitchProof(MIT・編みぐるみの段に対応)が約4週間前に出ている。
- ◆で「No」と言い切れるものは無いが、◆の1-1(実物の型紙での精度)・3-1(払う人の特定)・5-1(自動の下見に払われた跡)が「確かめていない」のまま残る。
- 残った問いと確かめる手段:
  1. 実際の編みぐるみ型紙(正誤表つき)で誤りを当てられるか: 案の test(5件)をそのまま。合格線は事前に決める(案の idea-194 は10件中5件)。
  2. 払う人の名前・集まる場所の数: Ravelry/Ribblr のデザイナー数は公式の数字が取れなかった。Etsy の編みぐるみ型紙の出品者の一覧を数える手段が要る(Etsy は今回開けていない)。
  3. 「人の校正の前に1型紙10〜20ドルの下見」に払う客がいるか: 同じ客に聞く以外に確かめる手段が無い(外への連絡はオーナーが決める)。
  4. StitchProof が「デザイナー向けに有料化」するかの動き(リポジトリは★0、実在デザイナーの下書きは未評価)。

## 観点の表
| 番号 | 答え | 印 | 出典 | 原文 |
|---|---|---|---|---|
| 0-1〜0-6 | オーナーの判断待ち | - | - | - |
| 1-1◆ | 機械で検算できるのは目数・増減・繰り返し。図と文の一致・分かりやすさは人。StitchProof の自己評価は人工データ45件中43件(95.6%)・別の型紙18件中18件。本物の型紙は未評価、誤警報22.2%。ウチの精度は未測定 | 確かめていない(他者の数字は確かめた) | https://github.com/HeetRanpura/stitchproof | "training data is synthetic, and no real designer drafts have been evaluated yet" |
| 1-2◆ | 型紙は誤り1つで読者が詰まる物。納める前の誤り率の提示は可能だが、ウチ自身の率は未測定 | 確かめていない | 同上 | 同上 |
| 1-3◇ | 原価は小さい(StitchProof はローカル実行、モデル構築 US$1.62)。ウチの構成のトークン費は未計算 | 見立て | https://dev.to/heet_ranpura/i-stopped-asking-ai-to-count-now-it-catches-956-of-the-mistakes-in-crochet-patterns-on-a-laptop-1el0 | "US$1.62 of Tinker credit" |
| 1-5◇ | 納めるのは検算の指摘で、型紙そのものではない。止める権利の問題は小さい | 見立て | - | - |
| 2-1◆ | Payhip は Stripe で日本から受け取れる(Stripe の対応国に日本)。法人の有無での区別は読んでいない | 確かめた(国)/確かめていない(個人区分) | https://help.payhip.com/article/65-how-do-i-get-paid | "Stripe is currently supported in over 40 countries including"(日本が含まれる) |
| 2-2◆ | Fiverr・Payhip の本人確認の書類は今回開けていない(Fiverr は 403) | 確かめていない | - | - |
| 2-3◆ | Fiverr: AI の利用は客に頼まれたら開示、客が拒めば従う。禁止ではない(検索の要約。公式ページは 403 で開けず) | 確かめていない | https://help.fiverr.com/hc/en-us/articles/37333301560593 | 検索の抜粋のみ: "freelancers must disclose their AI tool use when a client asks" |
| 2-5◆ | 禁止品目・医療に当たらない | 見立て | - | - |
| 2-7◇ | Fiverr 手数料は一律20%(二次情報)。変更の回数は未調査 | 確かめていない | 検索の抜粋のみ | - |
| 3-1◆ | 払う人の数は取れていない。Ravelry の全分野の型紙は2022年に7万件超/年で、デザイナー数の公式の数字は無い。一覧にできた名前は0件 | 確かめていない | https://blog.ravelry.com/2022-community-stats(検索の抜粋) | "over 70,000 of which were published in 2022" |
| 3-2◆ | Ribblr の掲示板は自分の店・作品・型紙の宣伝だけ許し、外部リンク禁止。検算サービスの宣伝は書かれていない=使えない見立て | 確かめた(規則)/見立て(サービスは不可) | https://meet.ribblr.com/t/community-guidelines-update-new-chat-channel/431551 | "External links are not allowed."(2024-10-06) |
| 3-3〜3-4◇ | Fiverr に既に校正の出品が複数ある(順位・広告費は未調査) | 確かめていない | 検索結果のURL一覧 | - |
| 4-2◇ | 編み物の客がAI製を嫌うかは未調査。ただし検算は人の校正の前の補助と位置づければ弱い | 見立て | - | - |
| 4-3◇ | 英語・北米/英国の時差の中での返信。注文ごと型で毎件人手の問い合わせ対応が要る | 見立て | - | - |
| 5-1◆ | 人の校正には払われた跡あり。(a)英国の校正係 £30/時・1型紙0.5〜7時間の見積り(b)掲示板で米国の校正係は「$20-$30 per hour」(1人の発言)(c)Fiverr の校正は$50〜100(検索の抜粋・ページは403で未確認)。しかし案の「月99ポンド4時間の会員」は Sycamore のページに書かれていない(誤り)。自動の10〜20ドルの下見に払った跡は0件。デザイナーの中には「稼ぎが無く払えない」人もいる | 確かめた(人の校正)/確かめていない(自動の下見) | https://www.samlovesyarn.co.uk/services-7 ・ https://meet.ribblr.com/t/tech-editing/210921 | "My current rates are £30/h for editing and grading" / "Most US tech editors charge $20-$30 per hour billed in 15 min increments." / "I don't make any real income from my patterns." |
| 5-2◆ | 無料の代わり: StitchProof(MIT、makers は無料、ただし Python3.11・llama.cpp・約3GB・Tinker キーが要り、非技術者には敷居が高い)、StitchCounter(Mac/iOS、文から目数を数える)、Sheepas(編み図作成アプリ、$1.99、"Catch inconsistent stitch counts")、AI Crochet Maker(自分の生成物のみ検算)、一般AI(目数を間違えると複数の記事が指摘)。足りているか=ふつうのデザイナーには敷居が高いが、設計が同じ無料品が既にあり差は小さい | 確かめた(存在)/見立て(足りるか) | https://github.com/HeetRanpura/stitchproof ・ https://apps.apple.com/app/id6761004151 ・ https://aicrochetmaker.com/ | "makers use it free"; "Catch inconsistent stitch counts, increases, decreases, and parent connections." |
| 5-3◇ | 人の校正は£30/時・0.5〜7時間(=£15〜£210)。自動の下見10〜20ドルは安いが、客が払う額の根拠は無い | 見立て | 同上 | - |
| 5-4◆ | 使う人=払う人(デザイナー本人) | 見立て | - | - |
| 5-7◇ | 型紙の発売のたびに需要。季節は未調査 | 確かめていない | - | - |
| 7-1◇ | Payhip 経由なら Stripe の 2.9%+$0.30(Payhip の無料プランの手数料は記載なし)。Fiverr なら20%+出金手数料。1件10〜20ドルだと固定費の割合が大きい | 確かめた(Stripe)/確かめていない(Payhip) | https://help.payhip.com/article/65-how-do-i-get-paid | "2.9% + $0.30 per transaction" |
| 7-2◆ | Payhip→Stripe→日本の口座は可。Fiverr は日本の口座への出金が Payoneer 経由か未確認 | 確かめた(Payhip)/確かめていない(Fiverr) | 同上 | - |
| 7-3◆〜7-5◆ | Payhip・Stripe の最低額・保留・凍結条件は未読 | 確かめていない | - | - |
| 8-3◇ | 国外の客への役務は輸出免税(確かめ済みの事実) | 確かめた(既知) | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shohi/6551.htm | - |
| 8-4◆ | 海外のVAT: 自店なら「サービスとして売る」か「デジタル品」かで扱いが変わる。Gumroad は MoR と書くが、サービスに当てはまるかは書かれていない。Payhip は「all sales of digital items」。注文ごとに作る下見は区分が曖昧 | 確かめていない | https://gumroad.com/taxes ・ https://help.payhip.com/article/127-digital-eu-vat | "all sales of digital items (such as ebooks)" |
| 8-1,8-5,8-6◇ | 未調査(米国の客の所得の出どころは仕事をした場所=日本なので米国の源泉は掛からない見立て) | 見立て | https://www.irs.gov/individuals/international-taxpayers/nonresident-aliens-source-of-income | - |
| 9-1◇ | 返金・チャージバックは Stripe 1,500円(既知)。10〜20ドルの商品では1件で利益が消える | 確かめた(既知) | https://stripe.com/jp/pricing | - |
| 9-2◆ | デジタル品の撤回の例外の同意の取り方、購読ではないので解約通知は不要。未調査 | 確かめていない | - | - |
| 9-6◇ | 誤りの申し立ては注文ごとに人手 | 見立て | - | - |
| 10-1◇ | デザイナーは新作ごとに再購入の余地あり | 見立て | - | - |
| 10-2◇ | Payhip は客のメールが取れる(未確認) | 確かめていない | - | - |
| 10-3◇ | すぐ同じことをする者: StitchProof(約4週間前に公開、★0)、AI Crochet Maker、Sheepas。大手の売り場(Ribblr の ePattern)に検算機能があるかは検索で出ず | 確かめた(先行者の存在) | 同上 | - |
| 10-4◇ | idea-194(編み物の型紙の検算)と買い手・仕組みが同じ。案の記録のとおり、外れるときは一緒 | 確かめた(案の記録) | hq/ideas.json | - |
| 10-5◇ | 注文ごと型なので件数に比例して手が要る | 見立て | - | - |
| 6-5,他 | 該当しない | - | - | - |
(4-1,4-4,6-x,9-3〜9-5 は型に当たらない)

## 「無い」と書いたものの探し方
- 「検算専用の道具が無い」→案の記録は誤り。英語の検索3回+日本語1回で StitchProof・AI Crochet Maker・Sheepas・StitchCounter を見つけた。日本語側は App Store の内容がヒット。
- 「Ribblr に自動の検算が無い」→英語の検索1回で出ず(売り場の中の検索は直接開けていない)=「見つからなかった」止まり。

## 案の記録と違っていたこと
- 「専用の道具は見つからない」→ 誤り。StitchProof(2026-10-18ごろ公開、MIT、編みぐるみの段に対応、設計が同じ)がある。
- 「月99ポンドで4時間の会員(Sycamore Studio)」→ そのページに会員も99ポンドも4時間も無い(£30/時、見積り0.5〜7時間、£150超は20%前払い)。
- 「時給20〜30ドル(ribblr の1人の話)」→ 原文は合う。ただし1人の発言で、同じ掲示板に「稼ぎが無く払えない」人もいる。
- 案の q1 の「道具は見つからない」を前提にした reason「買い手は idea-194 とほぼ同じ」は合う(同じ客)。
- 案が書く「1型紙10〜20ドル」の払った跡は見つかっていない(人の校正は£30/時やFiverr約$50〜100の抜粋)。

## 数
- WebSearch 14回、WebFetch 開けたページ 15(開けた: ribblr tech-editing, samlovesyarn, abcrafty, payhip TechEditor 2ページ, apps.apple Sheepas, StitchProof GitHub, dev.to, aicrochetmaker, ribblr ガイドライン, payhip help 65・173, gumroad taxes, aiknitting substack)。開けなかった: Fiverr 各ギグ・Fiverr help 2件(403)、payhip help 177(404)、knitcrochetcreate(404)。
