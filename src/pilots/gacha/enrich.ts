import { AiSession, responseText, type AiBudget } from "../../factory/ai";
import type { GachaItem } from "./types";
import { CATEGORIES, TRANSLATED_LANGUAGES } from "./languages";

// Haiku 4.5では実在しない作品名を当てる誤り(ブルーハムハム→Hamtaro等)が出たため、作品名の正確さを優先してSonnetを使う
const MODEL = "claude-sonnet-5-5";
const BATCH_SIZE = 25;

function needsEnrichment(item: GachaItem): boolean {
  return !item.enrichedAt || TRANSLATED_LANGUAGES.some((l) => !item.translations[l.code]);
}

function buildSystemPrompt(knownFranchises: string[]): string {
  return `You translate and tag Japanese capsule toy (gacha) product names for an overseas fan information site.
For each input product return:
- properNouns: every proper noun in the Japanese name (franchise / character / brand / artist / group / game titles), written as they appear. List these first; they are the candidates for franchise.
- names: the product name translated into each target language (${TRANSLATED_LANGUAGES.map((l) => `${l.code}=${l.nameForAi}`).join(", ")}). Use the official localized titles of anime/game/character franchises when they exist (e.g. ポケモン→Pokémon, ちいかわ→Chiikawa, 名探偵コナン→Detective Conan / Détective Conan). Keep it a natural product title; translate bracketed notes such as 【...限定】 briefly. Do not invent details that are not in the Japanese name.
- franchise: the franchise, character, brand, artist or group that appears in the Japanese product name, as its official English title (e.g. "Pokémon", "Chiikawa", "Miffy", "Crayon Shin-chan", "Hololive", "RIIZE"). Most gacha products are licensed, so set it whenever such a name is in the product name. It must be derivable from the product name itself: do not guess a parent company or umbrella brand (e.g. use "Sanrio" only for Sanrio characters such as Hello Kitty, My Melody or Kuromi; Miffy is not Sanrio). Pick the franchise from properNouns; ignore maker product-line names such as めじるしアクセサリー, CAPSULEVERSE, フラットガシャポン or CAP'in GALLERY. Use null only when properNouns contains no franchise (e.g. generic animal or food miniatures). Reuse one of these existing names exactly when it is the same franchise: ${knownFranchises.length > 0 ? knownFranchises.join(" | ") : "(none yet)"}
- category: one of ${CATEGORIES.join(", ")}.`;
}

function outputSchema() {
  const nameProps = Object.fromEntries(TRANSLATED_LANGUAGES.map((l) => [l.code, { type: "string" }]));
  return {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            names: {
              type: "object",
              properties: nameProps,
              required: TRANSLATED_LANGUAGES.map((l) => l.code),
              additionalProperties: false,
            },
            properNouns: { type: "array", items: { type: "string" } },
            franchise: { anyOf: [{ type: "string" }, { type: "null" }] },
            category: { type: "string", enum: [...CATEGORIES] },
          },
          required: ["index", "names", "properNouns", "franchise", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };
}

interface Enrichment {
  index: number;
  names: Record<string, string>;
  franchise: string | null;
  category: string;
}

// 未処理の商品と、言語追加で翻訳が欠けた商品だけをAIに渡す(処理済みは再処理しない)
export async function enrichPending(store: Map<string, GachaItem>, budget: AiBudget): Promise<void> {
  const pending = [...store.values()].filter(needsEnrichment);
  if (pending.length === 0) return;

  const ai = new AiSession(budget, "pilot-gacha-sonnet", MODEL);
  let enriched = 0;

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    // 作品名の表記揺れ("Chiikawa"と"Chiikawa (ちいかわ)"等)を防ぐため、既出の作品名をバッチごとに渡し直す
    const knownFranchises = [...new Set([...store.values()].map((i) => i.franchise).filter((f): f is string => !!f))].sort();
    const userContent = batch.map((item, i) => `index=${i} maker=${item.maker} name=${item.nameJa}`).join("\n");
    try {
      const response = await ai.create({
        max_tokens: 16000,
        system: buildSystemPrompt(knownFranchises),
        messages: [{ role: "user", content: userContent }],
        output_config: { effort: "low", format: { type: "json_schema", schema: outputSchema() } },
      });
      // 予算切れ: 残りは未処理のまま次回に回す
      if (!response) break;
      if (response.stop_reason !== "end_turn") {
        // refusal・max_tokensのバッチは未処理のまま残し、次回実行で再処理する
        console.error(`[enrich] batch@${start} stop_reason=${response.stop_reason}、スキップ`);
        continue;
      }
      const parsed = JSON.parse(responseText(response)) as { results?: Enrichment[] };
      const now = new Date().toISOString();
      for (const result of parsed.results ?? []) {
        const item = batch[result.index];
        if (!item) continue;
        for (const lang of TRANSLATED_LANGUAGES) {
          const name = result.names[lang.code]?.trim();
          if (name) item.translations[lang.code] = { name };
        }
        item.franchise = result.franchise?.trim() || null;
        item.category = result.category;
        item.enrichedAt = now;
        enriched++;
      }
    } catch (err) {
      console.error(`[enrich] batch@${start} failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  await ai.record(`ガチャパイロット: ${enriched}件を翻訳・タグ付け(${TRANSLATED_LANGUAGES.map((l) => l.code).join("/")})`);
  console.log(`[enrich] pending=${pending.length} enriched=${enriched} costUsd=${ai.costUsd.toFixed(4)}`);
}
