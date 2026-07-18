import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractCandidates } from "./extractCandidates";
import { runCouncilForTopic } from "./runCouncil";
import { notifyCouncilVerdict } from "./notify";
import { generateInvestigationPrompt } from "./generatePrompt";

// 候補数が多い場合の評議会実行コストを抑えるための上限。
// 需要があれば引き上げを検討する(GOVERNANCE.mdの予算競合リスク提示義務に基づき都度報告する)
const MAX_CANDIDATES_TO_EVALUATE = 5;

const CANDIDATES_DIR = path.resolve(process.cwd(), "council-output", "candidates");
const VERDICTS_DIR = path.resolve(process.cwd(), "council-output", "verdicts");

function slugifyForFile(topic: string): string {
  return topic.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "topic";
}

// 手動実行(npm run council:run)・将来のcron実行のいずれも本関数を呼ぶ。
// トリガー手段を差し替えるだけで完全自動化に移行できる構造にしている
export async function runCouncilPipeline(): Promise<void> {
  console.log("[council] 候補抽出を開始します(直近7日分のテーマHソース)");
  const candidates = await extractCandidates();
  console.log(`[council] 候補${candidates.length}件を抽出しました`);

  await mkdir(CANDIDATES_DIR, { recursive: true });
  const candidatesFile = path.join(CANDIDATES_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(candidatesFile, JSON.stringify(candidates, null, 2), "utf-8");

  if (candidates.length === 0) {
    console.log("[council] 候補がゼロのためパイプラインを終了します");
    return;
  }

  const targets = candidates.slice(0, MAX_CANDIDATES_TO_EVALUATE);
  if (candidates.length > targets.length) {
    console.log(
      `[council] 候補${candidates.length}件中、スコア上位${targets.length}件のみ評議会にかけます(コスト抑制のため)`,
    );
  }

  await mkdir(VERDICTS_DIR, { recursive: true });

  let totalCostJpy = 0;
  const adoptedTopics: string[] = [];

  for (const candidate of targets) {
    console.log(`[council] 評議会実行中: ${candidate.topic}`);
    const result = await runCouncilForTopic(candidate);
    totalCostJpy += result.estimatedCostJpy;

    const verdictFile = path.join(VERDICTS_DIR, `${slugifyForFile(result.topic)}.json`);
    await writeFile(verdictFile, JSON.stringify(result, null, 2), "utf-8");
    console.log(
      `[council] 裁定: ${result.verdict}(${candidate.topic}、見積コスト約${result.estimatedCostJpy.toFixed(1)}円)`,
    );

    await notifyCouncilVerdict(result);

    if (result.verdict === "採択") {
      const promptFile = await generateInvestigationPrompt(result);
      adoptedTopics.push(candidate.topic);
      console.log(`[council] 調査プロンプトを生成しました: ${promptFile}`);
    }
  }

  console.log(
    `[council] パイプライン完了。評議会実行${targets.length}件、採択${adoptedTopics.length}件、` +
      `合計見積コスト約${totalCostJpy.toFixed(1)}円`,
  );
}

if (require.main === module) {
  runCouncilPipeline()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
