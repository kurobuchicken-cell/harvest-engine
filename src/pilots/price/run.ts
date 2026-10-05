import "dotenv/config";
import { loadItems, saveItems } from "./store";
import { collectAll } from "./collect";
import { analyzePending } from "./analyze";
import { generateSite } from "./generate";

// --no-ai: AI抽出を飛ばす(未抽出の告知はページに出ない)。--generate-only: 収集もせず手元のデータからページだけ作る
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const store = await loadItems();

  if (!args.has("--generate-only")) {
    await collectAll(store);
    await saveItems(store);
    if (!args.has("--no-ai")) {
      await analyzePending(store);
      await saveItems(store);
    }
  }

  await generateSite(store);
}

main()
  // タイムアウトで打ち切った取得が裏で残っていてもプロセスを確実に終わらせる(定期実行で次回と重ならないように)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
