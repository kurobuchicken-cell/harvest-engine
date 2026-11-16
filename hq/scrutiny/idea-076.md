# idea-076 Telegram の Stars で AI 占い(1段目)
型: アプリ(Telegram の Bot)・自店に近い・海外・他言語・AI製・購読ではなく都度払い。束: 単独。判定日 2026-11-15。WebFetch は小さなモデルの要約。

| 観点 | 答え | 印 | 出典 | 原文 |
|---|---|---|---|---|
| 0.★ | オーナーの判断待ち | - | - | - |
| 5-2 無料の代わり | 無料の AI タロットが多数。一般の AI(ChatGPT)の手順記事もある。それでも金を払う客は実在する(5-1)ので、足りているとは言い切れない | 確かめた(無料の代わりの存在)/見立て | https://moge.ai/br/product/tarotoo(検索の抜粋のみ)、https://horadecodar.com.br/?p=46490(抜粋のみ) | 検索の抜粋のため開いていない。「Tarotoo は無料の AI リーディング」 → 未確認 |
| 5-1 払った跡 | Telegram の占い Bot に払う客は実在するが、数字は「最大の Bot の合計の月の売上は最大 5,000 万ルーブル」という記事の1行のみ。Stars の払い出しの実額・Bot 名は無し | 確かめた(記事の文)/確かめていない(個別の売上) | https://www.kommersant.ru/doc/8728135 | 「В месяц общий оборот крупнейших ботов-гадалок в Telegram может доходить до 50 млн руб.」「Цены начинаются от 50 звезд, что примерно 85 руб.」 |
| 2-1・2-2 受け取り | Stars の払い出しは Fragment 経由。「Fragment may be unable to issue rewards for certain users or in certain countries」。Fragment の規約には「Company may limit which countries it operates in」とあるだけで、国の一覧・本人確認の中身は無い。日本の個人に届くかは公開では決まらない | 検証で決まる(アカウント) | https://telegram.org/tos/bot-developers 、https://fragment.com/terms | 同上。21日の保留:「Stars in your balance may not become available for advertising credits or rewards for up to 21 days after」。1 Star 当たり「0.013 USD」 |
| 2-3 AI禁止 | Bot 開発者規約に AI で作った物の禁止は見つからない。AI 関連の文は、データを集めて AI を作る行為の禁止のみ | 確かめた(その規約の範囲で) | https://telegram.org/tos/bot-developers | 「any form of data collection aimed at creating large datasets, machine learning models and AI products」(§4.3)。禁止品目の近い文:「illegal, pirated, regulated or questionable goods and services」(§5.2h) |
| 2-6 資格 | 日本では占いは独占業務ではない。客の国ごとの占いの法律は確かめていない(記録: アラビア語圏は UAE で占いが犯罪のため外す) | 確かめていない | - | - |
| 5-10 先行者に勝てる理由 | 言えない。(a) Stars 払いの AI タロットの雛形が公開されていて誰でも複製できる (b) ロシア語圏に既存の Bot (c) 案の売り文句「全部の結果が読み解きつき」は AI タロットなら普通 | 見立て(材料は確かめた) | https://github.com/longdog/tarot-ai 、https://vc.ru/services/2219754-taro-onlajn-v-telegram-ai-bot(検索の抜粋のみ) | github:「Unlock premium tarot readings with Telegram Stars」。デモ Bot @aitarotcard_bot |

## 判定: 捨てる(5-10 が No)
- 理由: 作りが雛形で複製でき、勝てる点が言えない。記録も「なぜウチかは未解決」。買い手に人を連れてくる道(3-1・3-2)も記録の上で無い。
- 残る問い(捨てなかった場合のみ): 日本の個人に Stars の払い出しが届くか → アカウントを作って「報酬」の画面を見るしかない(外への手続き=オーナー承認)。

## 案の記録と違っていたこと
- 記録: 「インドで1回150〜700ルピーの占いに月約450万回の支払い(upstox)」を Telegram Stars の需要の根拠にしている。その記事は Astrotalk など別のアプリの話で、Telegram・Stars・Bot の記述は無い。「月450万回」は Astrotalk 1社の有料セッション数。Telegram の需要の根拠にはならない。
- Telegram の規約で「デジタル商品は Stars 払い」は確かめた(「transactions pertaining to digital goods and services must be executed exclusively through the exchange of Telegram Stars」)。
- 払い出し: Telegram は Stars を「0.013 USD」で報酬にすると規約に書く。最低額は規約に無い(1,000 Stars という第三者の文は未確認)。

## 手続き
検索 6回(Stars タロット / Fragment / 日本の出金 / Bot 一覧 / ポルトガル語 / ロシア語)。開いたページ 7(Bot 開発者規約 / core.telegram.org の Stars / kommersant / fragment 規約 / Stars 規約 / upstox / github)。開けなかった URL: https://tgstat.com/search?q=tarot&sort=members (403。Bot の一覧は別の道でも数えられなかった)。
「無い」: 「Stars の払い出しの国の一覧が無い」は規約2本+Telegram の説明ページ+第三者の解説の4か所で見つからず、「確かめていない」とした。
