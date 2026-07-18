import { recordChecklistItem, type ChecklistItemKey } from "./lib/legalChecklist";

const VALID_ITEMS: ChecklistItemKey[] = ["robotsTxt", "tos", "disclaimer", "trademark", "lawyer"];

async function main() {
  const [themeId, themeName, item, ...noteParts] = process.argv.slice(2);
  if (!themeId || !themeName || !item || !VALID_ITEMS.includes(item as ChecklistItemKey)) {
    console.error(
      `使い方: npm run legal:record -- <themeId> <themeName> <item> [note...]\n` +
        `item は ${VALID_ITEMS.join(" | ")} のいずれか\n` +
        `例: npm run legal:record -- C SaaS障害 robotsTxt "全社robots.txt再確認済み、Disallowなし"`,
    );
    process.exit(1);
  }
  const note = noteParts.join(" ") || undefined;
  const result = await recordChecklistItem(themeId, themeName, item as ChecklistItemKey, note);
  console.log(`記録しました:\n${JSON.stringify(result, null, 2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
