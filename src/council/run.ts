import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectRecentItems } from "./extractCandidates";
import { selectCandidates } from "./selectCandidates";
import { runCouncilForTopic } from "./runCouncil";
import { notifyCouncilVerdict } from "./notify";
import { generateInvestigationPrompt } from "./generatePrompt";

// 選定評議会が返す候補数の安全上限(選定側にも同じ上限を指示済みだが、二重の安全網として維持)
const MAX_CANDIDATES_TO_EVALUATE = 5;

const SELECTIONS_DIR = path.resolve(process.cwd(), "council-output", "selections");
const VERDICTS_DIR = path.resolve(process.cwd(), "council-output", "verdicts");

function slugifyForFile(topic: string): string {
  return topic.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "topic";
}

// 手動実行(npm run council:run)・将来のcron実行のいずれも本関数を呼ぶ。
// トリガー手段を差し替えるだけで完全自動化に移行できる構造にしている。
//
// フロー: 生データ収集(重複削除のみ、絞り込みなし)→ 選定評議会(生データを見て候補を選ぶ)
// → 判断評議会(選ばれた候補ごとに採択/却下/保留を審議、既存ロジック無改修)
export async function runCouncilPipeline(): Promise<void> {
  console.log("[council] 生データ収集を開始します(直近7日分のテーマHソース、重複削除のみ)");
  const items = await collectRecentItems();
  console.log(`[council] 生データ${items.length}件を収集しました`);

  if (items.length === 0) {
    console.log("[council] 生データがゼロのためパイプラインを終了します");
    return;
  }

  console.log("[council] 選定評議会を実行中(生データから候補を選定)");
  const selection = await selectCandidates(items);

  await mkdir(SELECTIONS_DIR, { recursive: true });
  const selectionFile = path.join(SELECTIONS_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(selectionFile, JSON.stringify(selection, null, 2), "utf-8");
  console.log(
    `[council] 選定完了: 候補${selection.candidates.length}件(見積コスト約${
      selection.estimatedCostJpy?.toFixed(1) ?? "不明(円換算未確定)"
    }円)`,
  );

  if (selection.candidates.length === 0) {
    console.log("[council] 選定評議会が候補ゼロと判断したためパイプラインを終了します");
    return;
  }

  const targets = selection.candidates.slice(0, MAX_CANDIDATES_TO_EVALUATE);
  if (selection.candidates.length > targets.length) {
    console.log(
      `[council] 選定候補${selection.candidates.length}件中、上位${targets.length}件のみ判断評議会にかけます(安全上限)`,
    );
  }

  await mkdir(VERDICTS_DIR, { recursive: true });

  let totalCostJpy = 0;
  let costUnresolved = selection.estimatedCostJpy === null;
  const adoptedTopics: string[] = [];

  for (const candidate of targets) {
    console.log(`[council] 判断評議会実行中: ${candidate.topic}`);
    const result = await runCouncilForTopic(candidate);
    if (result.estimatedCostJpy === null) {
      costUnresolved = true;
    } else {
      totalCostJpy += result.estimatedCostJpy;
    }

    const verdictFile = path.join(VERDICTS_DIR, `${slugifyForFile(result.topic)}.json`);
    await writeFile(verdictFile, JSON.stringify(result, null, 2), "utf-8");
    console.log(
      `[council] 裁定: ${result.verdict}(${candidate.topic}、見積コスト約${
        result.estimatedCostJpy?.toFixed(1) ?? "不明(円換算未確定)"
      }円)`,
    );

    await notifyCouncilVerdict(result);

    if (result.verdict === "採択") {
      const promptFile = await generateInvestigationPrompt(result);
      adoptedTopics.push(candidate.topic);
      console.log(`[council] 調査プロンプトを生成しました: ${promptFile}`);
    }
  }

  if (selection.estimatedCostJpy !== null) {
    totalCostJpy += selection.estimatedCostJpy;
  }

  console.log(
    `[council] パイプライン完了。選定+判断評議会実行${targets.length + 1}回、採択${adoptedTopics.length}件、` +
      `合計見積コスト約${totalCostJpy.toFixed(1)}円${costUnresolved ? "(一部円換算未確定分を除く)" : ""}`,
  );
}

if (require.main === module) {
  runCouncilPipeline()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
