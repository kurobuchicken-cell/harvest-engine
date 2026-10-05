import "dotenv/config";
import { loadItems, saveItems } from "./store";
import { collectBandai } from "./collectBandai";
import { collectTakaraTomyArts } from "./collectTakaraTomyArts";
import { enrichPending } from "./enrich";
import { generateSite } from "./generate";
import { targetMonths } from "./months";

// --no-ai: 翻訳・タグ付けを飛ばす(未翻訳の商品は日本語名のまま出る)。--generate-only: 収集もせず手元のデータからページだけ作る
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const store = await loadItems();

  if (!args.has("--generate-only")) {
    const months = targetMonths();
    // 片方のメーカーが落ちていても、もう片方の収集・ページ生成は続ける
    await collectBandai(store, months).catch((err) => console.error(`[bandai] failed: ${err instanceof Error ? err.message : err}`));
    await collectTakaraTomyArts(store, months).catch((err) => console.error(`[tta] failed: ${err instanceof Error ? err.message : err}`));
    await saveItems(store);
    if (!args.has("--no-ai")) {
      await enrichPending(store);
      await saveItems(store);
    }
  }

  await generateSite(store);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
