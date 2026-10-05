import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { MODEL } from "./pricing";
import type { RoundUsage } from "./types";

export const MAX_TOKENS = 16000;

let governanceCache: string | null = null;

export async function loadGovernance(): Promise<string> {
  if (governanceCache) return governanceCache;
  governanceCache = await readFile(path.resolve(process.cwd(), "GOVERNANCE.md"), "utf-8");
  return governanceCache;
}

// 選定(どのテーマを評議会にかけるか)・判断(採択/却下/保留)のどちらの評議会も、
// 同じ人格・同じ役割構成・同じ制約で審議する。役割が異なるのはユーザープロンプト側のみ
export async function buildSystemPrompt(): Promise<string> {
  const governance = await loadGovernance();
  return `あなたはharvest-engineプロジェクトの自動評議会です。以下のGOVERNANCE.mdに定められた経営体制・意思決定権限に従い、新テーマ候補を審議してください。

--- GOVERNANCE.md ---
${governance}
--- GOVERNANCE.md ここまで ---

--- 事業モデル: 出口工場(2026-10-05オーナー決定) ---
harvest-engineは「データを集めて企業に売る」B2B型から、「出口工場」による薄利多売型へ転換した。
出口工場とは、一次情報源(メーカー公式の新商品ページ・官公庁発表等)を自動収集し、AIで構造化して、
日本語ページ(国内向け)と英語ページ(海外向け)・SNS投稿を自動生成し、アフィリエイト・広告で
小さく稼ぐ仕組みである。1ジャンルあたりの収益は小さくてよく、ジャンル数を可能な限り増やして
積み上げる。特に「日本語でしか出ていない日本の情報を、海外に届ける」方向を重視する
(言語の壁が参入障壁になり、AIの強みが活きるため)。海外は当面英語から始めるが、英語に限定しない。
AI翻訳で言語の追加はほぼ無料のため「ジャンル×言語」の掛け算も多売の軸であり、ジャンルごとに
どの国・言語(例: 英語圏、台湾・香港の繁体字、韓国語、東南アジア、中南米のスペイン語・ポルトガル語)
に需要があるかを評価すること。中国本土はGoogleが使えず流入経路が異なる点に注意。
評議会が探し・審議するのは、この出口工場に載せられる「ジャンル」である。
ジャンル単位で大手が押さえている領域は避け、一次情報源があり定期的に更新される
ロングテールの隙間を優先すること。AIで量産しただけの低付加価値ページは検索エンジンの
ペナルティ対象になるため、一次情報に基づく網羅性・速報性で付加価値を出せるかを必ず検討すること。
--- 事業モデルここまで ---

評議会は以下の6役で構成されます。それぞれの視点から発言してください。
1. 市場戦略家: 国内・海外それぞれの需要の兆候(検索・コミュニティ)と、競合の手薄さを評価する
2. リスク管理官: robots.txt/ToS・翻訳再配信の可否・画像等の著作権・レピュテーションリスクを評価する
3. ハーヴェスト理論の番人: 一次情報源の有無と更新頻度、出口工場への載せやすさ、多売(ジャンル横展開)への寄与を評価する
4. 地域リサーチャー: 対象ジャンルが日本向け/海外向け/両方のどれに向くか、海外ならどの国・言語に需要があるかを、実際にweb_searchで裏取りしながら評価する
5. 運用・財務担当: 収益化手段(アフィリエイト制度の有無・広告単価)と、収集コスト・API予算・巡回負荷の見込みを評価する
6. 監査役: 他5役の発言に対し、既存資産や直前の結論へのアンカリングがないかを検査する。監査役コメントは必須項目であり、省略してはならない

重要な制約: 裁定項目に「現有資産適合」のような既存プロジェクトを有利にする項目を入れてはならない。
選択肢生成の段階で既存資産・直前の結論に引っ張られていないかを、監査役が必ず検査すること。

推測ではなくweb_searchで検索した事実に基づいて発言してください。`;
}

// LLMが```json ... ```ブロックの末尾に余分な閉じ括弧等を出力する既知の失敗パターンに対応する。
// 素のJSON.parseが失敗した場合、末尾から1文字ずつ削って再パースを試みる(最大20文字)。
// 「有効なJSONの後に余分な非空白文字がある」系のエラーはこれで大半が復旧できる。
// 復旧してもなお失敗する場合はnullを返し、呼び出し側の安全側フォールバックに委ねる
export function extractJsonBlock<T>(text: string, validate: (parsed: unknown) => parsed is T): T | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;

  const raw = match[1];
  const MAX_TRIM = 20;
  for (let trim = 0; trim <= MAX_TRIM && trim < raw.length; trim++) {
    const candidate = trim === 0 ? raw : raw.slice(0, -trim);
    try {
      const parsed = JSON.parse(candidate);
      if (validate(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export function extractText(content: ContentBlockParam[] | Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n");
}

export function toRoundUsage(usage: Anthropic.Usage): RoundUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
    webSearchRequests: usage.server_tool_use?.web_search_requests ?? 0,
  };
}

// web_searchはサーバー側ツールのため、内部の検索反復が10回を超えるとpause_turnで一旦返る。
// 新しいuser発言を追加せず同じmessagesで再送すると続きから再開する
export async function runUntilComplete(
  client: Anthropic,
  systemPrompt: string,
  messages: MessageParam[],
): Promise<{ message: Anthropic.Message; usage: RoundUsage }> {
  const aggregated: RoundUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    webSearchRequests: 0,
  };
  let working = [...messages];
  let message: Anthropic.Message;

  for (;;) {
    // systemPrompt(GOVERNANCE.md全文込み)は同一週内の選定+複数の判断評議会で毎回同一のため、
    // ephemeralキャッシュ(既定TTL5分)でヒットさせコストを下げる。週次実行内の呼び出し間隔は
    // 実測4〜5分でTTL内に収まる(データ収集等の合間で6分以上空くと再度キャッシュ書き込みになるだけで、
    // 挙動自体は変わらない)
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: working,
    });
    message = await stream.finalMessage();

    const roundUsage = toRoundUsage(message.usage);
    aggregated.inputTokens += roundUsage.inputTokens;
    aggregated.outputTokens += roundUsage.outputTokens;
    aggregated.cacheCreationInputTokens += roundUsage.cacheCreationInputTokens;
    aggregated.cacheReadInputTokens += roundUsage.cacheReadInputTokens;
    aggregated.webSearchRequests += roundUsage.webSearchRequests;

    if (message.stop_reason !== "pause_turn") break;
    working = [...working, { role: "assistant", content: message.content }];
  }

  return { message, usage: aggregated };
}
