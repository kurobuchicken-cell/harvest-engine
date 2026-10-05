import "dotenv/config";
import { loadItems, saveItems } from "./store";
import { collectJgrants, normalizeSourceFields } from "./collectJgrants";
import { collectJnet21, kindFromSubject } from "./collectJnet21";
import { classifyPending } from "./classify";
import { generateSite } from "./generate";
import { unknownValues } from "./taxonomy";

// --no-ai: AI分類を飛ばす(未分類のJ-Net21案件はページに出ない)。--generate-only: 収集もせず手元のデータからページだけ作る
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const store = await loadItems();

  if (!args.has("--generate-only")) {
    // 片方の情報源が落ちていても、もう片方の収集・ページ生成は続ける
    await collectJgrants(store).catch((err) => console.error(`[jgrants] failed: ${err instanceof Error ? err.message : err}`));
    await collectJnet21(store).catch((err) => console.error(`[jnet21] failed: ${err instanceof Error ? err.message : err}`));
    await saveItems(store);
    if (!args.has("--no-ai")) {
      await classifyPending(store);
      await saveItems(store);
    }
  }

  for (const item of store.values()) {
    if (item.sourceFields) Object.assign(item, normalizeSourceFields(item.sourceFields));
    if (item.source === "jnet21" && item.rawText) item.kind = kindFromSubject(item.rawText.split("\n")[0]);
  }
  await saveItems(store);
  await generateSite(store);
  if (unknownValues.size > 0) {
    console.warn(`[taxonomy] 語彙に無い値 ${unknownValues.size}種(taxonomy.tsへの追加を検討):`, [...unknownValues]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
