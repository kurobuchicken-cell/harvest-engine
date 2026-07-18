import {
  getThemeChecklist,
  EXIT_LITE_REQUIRED,
  FULL_EXIT_REQUIRED,
  isLayerReady,
  type ChecklistItemKey,
} from "./lib/legalChecklist";

const ITEM_LABELS: Record<ChecklistItemKey, string> = {
  robotsTxt: "robots.txt確認",
  tos: "ToS確認(自動収集禁止条項・信用毀損リスク・商標リスク)",
  disclaimer: "免責文言・出典リンク",
  trademark: "商標調査",
  lawyer: "弁護士スポット相談",
};

async function main() {
  const [themeId, targetLayer] = process.argv.slice(2);
  if (!themeId || (targetLayer !== "2.5" && targetLayer !== "3")) {
    console.error("使い方: npm run legal:check -- <themeId> <2.5|3>\n例: npm run legal:check -- C 3");
    process.exit(1);
  }

  const required = targetLayer === "3" ? FULL_EXIT_REQUIRED : EXIT_LITE_REQUIRED;
  const checklist = await getThemeChecklist(themeId);
  const ready = isLayerReady(checklist, required);

  console.log(`=== 法務ゲート判定: テーマ${themeId} → 第${targetLayer}層 ===`);
  for (const key of required) {
    const status = checklist?.[key];
    const mark = status?.done ? "✅" : "❌";
    const detail = status?.done ? `(確認日時: ${status.confirmedAt}${status.note ? ` / ${status.note}` : ""})` : "";
    console.log(`${mark} ${ITEM_LABELS[key]}${detail}`);
  }
  console.log(`\n判定: ${ready ? "PASS(昇格要件を満たしています)" : "FAIL(未完了の項目があります)"}`);

  if (!ready) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
