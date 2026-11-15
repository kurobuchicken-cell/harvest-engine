# idea-194 精査(編み物の型紙の自動検算の下見)

## 型
自店(Payhip 等の自分の店・Stripe) / 海外(客は英語圏) / 他言語(英語で作る・対応) / AI製 / 注文(型紙ごとに作る) / 損(誤りが客の損=糸・時間の無駄) 。売場は Fiverr に出す場合のみ(未調査)。

## 観点(0.★は「オーナーの判断待ち」。11.は当てていない)
| 番号 | 答え | 印 | 出典 | 原文 |
|---|---|---|---|---|
| 0-1〜0-6 | オーナーの判断待ち | - | - | - |
| 1-1◆ | 目の数の足し引きは機械で検算できる。ただし書き方がばらばらの型紙(略語・図と文の食い違い)を正しく読めるかは、この案の最大の技術の不確かさ。母語話者による確認が要る部分(文の分かりやすさ)は人の校正が担う。誰がいくらで確かめるかは未定 | 確かめていない(技術は試しで決まる) | https://aiknitting.substack.com/p/ask-claude | 「Many AI-generated patterns simply don't add up once you start knitting them.」(一般の AI は数えを誤る、の傍証) |
| 1-2◆ | 誤りの率は、無料の型紙10件の試し(案の test)をやるまで数えられない | 確かめていない | (案の test) | - |
| 1-3◇ | トークン原価は未計算。型紙1件ごとの注文生成 | 確かめていない | - | - |
| 1-4◆ 1-6 | 客が預けた自分の型紙を使うので素材の許諾は当たらない。「〜対応」と他者名を使う形でもない | 見立て | 案の legal | - |
| 1-5 | 人の手が入らない物ではなく検算の結果の報告。写されて止める権利の話は薄い | 見立て | - | - |
| 2-1◆ | Payhip の Stripe 対応国に日本が入る。Payhip は店の運営者、受取は自分の Stripe/PayPal | 確かめた | https://help.payhip.com/article/65-connecting-your-stripe-account | 「Austria, Australia, ... Italy, Japan, Latvia ...」 |
| 2-2◆ | Stripe 日本の本人確認はオーナーが出せる範囲か未確認 | 確かめていない | - | - |
| 2-3◆ | Payhip の AI 規約は調べていない。Ravelry の規約には AI の項目が無い | Payhip 確かめていない/Ravelry 確かめた | https://www.ravelry.com/about/guidelines | 「The page has no rules on ... AI-generated content」(ページ全体を見た結果) |
| 2-5・2-6 | 型紙の校正は資格者の独占業務ではない(見立て)。調べていない | 見立て | - | - |
| 2-7◇ | Payhip の手数料: 無料プラン5%、Plus 2%、Pro 0%。変更履歴は未調査 | 確かめた(今の値)/履歴は確かめていない | https://payhip.com/pricing | 「Free Forever +5% transaction fee」 |
| 3-1◆ | 払う人は Ravelry の型紙デザイナー。名前は公開の型紙ページで特定できる。2022年に 87,106 件の型紙が追加、7万件超が2022年に公開、初公開の型紙に出たデザイナー 3,486 人。ただしこれは出した人の数で、払う人(校正に払う人)の数ではない | 確かめた(数)/払う人の数は確かめていない | https://blog.ravelry.com/2022-community-stats | 「over 70,000 of which were published in 2022」「3,486 designers appeared in debut patterns spotlight」 |
| 3-2◆ | 広告費なしの道: Ravelry のグループへの投稿。同じ文を3つ以上の掲示板に許可なく出すのと、未承諾の販促の個人メッセージはスパム。グループの許可を得れば道はある。個別のグループの規則は未確認。外への連絡はオーナーが決める | 確かめた(全体の規則)/グループごとは確かめていない | https://www.ravelry.com/about/guidelines | 「Unsolicited promotional private messages are spam.」「Posting the same message to more than 2 boards without permission from the group owner/moderators is not permitted.」 |
| 3-3・3-4 | Fiverr に出す場合の検索順位・広告は未調査(Fiverr は検索の抜粋のみ、ページは403で開けず) | 確かめていない | - | - |
| 3-5 | 需要の季節性は未調査 | 確かめていない | - | - |
| 4-2◇ | 編み物の界隈は AI 製に懐疑的(型の生成について)。検算の道具への反応は未調査 | 見立て | https://aiknitting.substack.com/p/ask-claude | 「Double and triple check the numbers, graphs, schematics - everything.」 |
| 4-3◇ | 英語・時差の返信は未調査(下見を即日出す想定) | 確かめていない | - | - |
| 5-1◆ | 校正に払われている: 時給20〜30ドル(Payhip の PatternDesignCircle)、1型紙 Fiverr 50ドル3日・Contra 20ドルから、英国の編集者 1型紙 約30〜50ポンド(検索の抜粋)。ただし「自動の下見」に払った跡は無い | 校正は確かめた(Payhip原文)/他は検索の抜粋のみ=未確認/下見への支払いは確かめていない | https://payhip.com/PatternDesignCircle/blog/pattern-design-circle-blog/a-knitting-pattern-designer-s-guide-to-tech-editing-what-why-and-how-pattern-tech-editing-works | 「most of the tech editor fees that I have seen are between $20 USD and $30 USD per hour」 |
| 5-2◆ | 無料の代わり: (a)Stitch Fiddle の「Chart check」(図の行ごとの目の数の過不足を自動で指す。価格は同ページに無い、Premium の区分あり) (b)デザイナー自身の事前の見直し(Payhip の記事が勧める) (c)一般の AI は数えを誤る傾向。ただし Stitch Fiddle は図が対象で、文章の型紙の全サイズの検算は見つからなかった | 確かめた(Stitch Fiddle の存在)/文章の型紙の検算ツールが無いは「Claude の検索3種+店内検索なし」まで | https://www.stitchfiddle.com/en/help/1pem-8ycy8n | 「You check a chart for errors automatically, by checking whether there are too few or too many stitches in a particular row.」 |
| 5-3◇ | 1型紙10〜20ドルは、人の校正(50ドル程度〜)の2〜4割。下見だけでは人の校正は省けない(編集者は文章・図・体裁も見る)ので、「払う余地」は人の校正代の減りで決まる。Payhip 記事は数の誤りが編集の時間と費用を増やすと述べる | 見立て | https://payhip.com/PatternDesignCircle/blog/pattern-design-circle-blog/how-to-decrease-tech-editing-costs-your-knitting-pattern-editing-checklist | 数の誤りが「one early mistake can make an editor think the rest of the pattern is wrong」の趣旨(要約) |
| 5-4◆ | 使う人=払う人(デザイナー本人) | 見立て | 案の記録 | - |
| 5-6◇ | 英語圏はカード・PayPal で足りる見立て | 見立て | - | - |
| 5-7◇ | 季節性は未調査 | 確かめていない | - | - |
| 7-1◇ | Payhip 5%(無料プラン)+ Stripe 3.6%(日本・known-facts)で、15ドルなら約1.3ドル。通貨換算の+2%は別。1件約 12.5 ドル残る見立て | 見立て(率は確かめた) | https://payhip.com/pricing / known-facts の Stripe | - |
| 7-2◆ | Payhip→Stripe(日本)で個人の口座へ届く経路はある | 確かめた(Stripe 対応国に日本) | https://help.payhip.com/article/65-connecting-your-stripe-account | 同上 |
| 7-3◆ | Payhip は取引ごとに即時に入る。最低の支払い額・保留は Stripe 側で未調査 | Payhip 確かめた/Stripe 側確かめていない | https://payhip.com/pricing | 「We will deposit your sales to you immediately after a transaction has been completed.」 |
| 7-5◆ | 停止・凍結の条件は未調査 | 確かめていない | - | - |
| 8-1・8-6◇ | 役務は日本の個人が国外へ。米国の源泉は仕事をした場所で決まるので日本で作業なら対象外の見立て(known-facts)。確かめていない | 見立て | known-facts の IRS | - |
| 8-3◇ | 国外の客への役務は輸出免税(known-facts)。年の売上は小さい見立て | 確かめた(known-facts) | known-facts の国税庁 | - |
| 8-4◆ | 海外 VAT: Payhip は EU の「デジタル品」の VAT を扱うが、「検算の報告書」が対象かは書かれていない。サービスだと本人が登録する可能性。EU OSS の非EU枠に売上の下限なし。決め手の不確かさ | 確かめていない | https://help.payhip.com/article/127-digital-eu-vat / known-facts | 「all sales of digital items (such as ebooks)」(known-facts)。報告書がこれに当たるかは未確認 |
| 8-5 | 区分(事業所得か雑所得)は未調査 | 確かめていない | - | - |
| 9-1◇ | 返金・チャージバックは Stripe 日本で不審請求の申し立て 1,500円(known-facts)。1件約15ドル売上に対して重い | 確かめた(known-facts) | https://stripe.com/jp/pricing | - |
| 9-2◆ | 自店のデジタル品の撤回の権利の例外の同意、特商法の氏名・住所・電話の表示は0-1に当たる(オーナーの判断待ち) | 確かめていない | - | - |
| 9-4◆ | 検算の誤りで客が公開した型紙の誤り=糸と時間の無駄になるが、賠償の上限を利用規約で決める道は確かめていない。「人の校正の前の下見」で「人が最終判断」と線を引く案 | 確かめていない | - | - |
| 9-5 | 預かる型紙は公開前の著作物。個人情報ではない | 見立て | - | - |
| 9-6◇ | 誤りの申し立ては少数なら対応可、見立て | 見立て | - | - |
| 10-1◇ | デザイナーは新作ごとに需要(型紙は年に数件〜多数)。繰り返しの需要は見込める | 見立て | https://blog.ravelry.com/2022-community-stats | 年7万件の公開 |
| 10-2◇ | 自店なら客の連絡先が残る | 見立て | - | - |
| 10-3◇ | 当たったら: 一般の AI が自分で数える人が出る、Stitch Fiddle のような型紙の作成の道具が検算を足す。ウチにたまるのは各型紙の誤りの型のデータ | 見立て | https://www.stitchfiddle.com/en/help/1pem-8ycy8n | 「Chart check」が既にある |
| 10-4・10-5 | 台帳の同じ仕組みの案との関係は未確認。手は注文ごとの確認と返信が要る | 確かめていない | - | - |

### 市場の大きさ(案の記録の「未計算」の部分)
- 稼げる人が少ない: 「This is definitely a business that freelancers find it difficult to make a living in.」(2014年。古い) https://knittingrobin.blogspot.com/2014/08/how-many-hand-knit-pattern-designers.html 。Ravelry に載るデザイナー 32,357 人(2014年8月)。
- 年7万件の公開のうち、校正を使う割合は不明(確かめていない)。

## 判定: 調べきれない(試す候補寄り)
理由: ◆に No は見つからなかった。ただし決め手の◆に「確かめていない」が残る。
- 1-1/1-2 技術: 書き方がばらばらの型紙を正しく読めるか、誤りの率(試しの10件で決まる。費用0)
- 8-4 海外 VAT: 検算の報告書が Payhip の VAT の扱いの対象か、本人の登録が要るか
- 2-2 Stripe 本人確認、2-3 Payhip の AI 規約、7-3/7-5 Stripe の保留・停止
- 5-1/5-3 払う意思: 「自動の下見」への支払いの跡は無い。人の校正が 20〜50ドルなので、10〜20ドルの下見は高く見える可能性が大きい(確かめていない)
- 市場は小さい(稼げないデザイナーが多い)。収入の上限は計算していない
確かめる手段: (1) 案の test(Ravelry の正誤表つき無料の型紙10件、費用0) (2) Payhip のサポートの規約・VAT のページ原文(読むだけ) (3) Stripe 日本の支払いの周期と停止の条件のページ (4) デザイナーに値段を聞く調査は外への連絡なのでオーナーの判断。

## 案の記録と違っていたこと
- 「自動の検算の道具が無い」は不正確: Stitch Fiddle に図の行ごとの目の数の自動検査(Chart check)がある。文章の型紙の全サイズの検算は見つからなかった。
- 時給20〜30ドルは原文どおり(「$50 USD per hour and up」の例もある)。
- 「年7万件」は Ravelry の2022年の数(over 70,000)で合っている。ただし払う人の数ではない。
- 1型紙の人の校正は Fiverr 50ドル(検索の抜粋)で、下見10〜20ドルは校正の2〜4割。「払う余地」は十分でない可能性。
- 4件の sources のうち sycamorestudio は samlovesyarn.co.uk へ移っていた。編集・訳 1語0.08ポンドは原文どおり。

## 検索・ページ
- 検索 8回(WebSearch)
- 開いたページ 11(Payhip PDC 校正の記事・Ravelry 統計・Stitch Fiddle・Payhip TechEditor・knittingrobin・samlovesyarn・Payhip 費用の記事・Ravelry 規約・Payhip Stripe・aiknitting・Payhip pricing)
- 開けなかった 4(fiverr ×2・aiyd・newsbytes は403。sycamorestudio は転送を追って別の宛先で開けた)
- Perplexity は使っていない。Fiverr の価格は検索の抜粋のみ(未確認)。
