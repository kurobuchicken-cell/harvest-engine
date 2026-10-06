import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appendExpense } from "../lib/ledger";
import { recheckSources, researchSources, toMarkdown, type ResearchInput, type ResearchResult } from "./sourceResearch";

const OUTPUT_DIR = path.resolve(process.cwd(), "council-output", "source-research");

interface VerdictFile {
  topic: string;
  candidate?: { excerpt?: string; sourceUrls?: string[] };
  scoreTable?: { criterion: string; assessment: string }[];
}

// 引数が評議会の裁定JSONならその審議内容を文脈として渡し、それ以外はジャンル名の自由入力として扱う
async function resolveInput(arg: string): Promise<ResearchInput> {
  if (arg.endsWith(".json") && existsSync(arg)) {
    const verdict = JSON.parse(await readFile(arg, "utf-8")) as VerdictFile;
    const context = [
      verdict.candidate?.excerpt ? `候補の元情報: ${verdict.candidate.excerpt}` : "",
      verdict.candidate?.sourceUrls?.length ? `元情報のURL: ${verdict.candidate.sourceUrls.join(" ")}` : "",
      ...(verdict.scoreTable ?? []).map((s) => `${s.criterion}: ${s.assessment}`),
    ].filter(Boolean).join("\n");
    return { topic: verdict.topic, context };
  }
  return { topic: arg, context: "" };
}

async function main() {
  const args = process.argv.slice(2);
  const recheck = args[0] === "--recheck";
  const arg = (recheck ? args.slice(1) : args).join(" ").trim();
  if (!arg) {
    console.error('使い方: npm run research:sources -- <評議会の裁定JSONのパス | "ジャンル名">');
    console.error("        npm run research:sources -- --recheck <前回の調査結果JSONのパス>  (検索はやり直さず判定だけ更新)");
    process.exit(1);
  }

  let input: ResearchInput;
  let result: ResearchResult;
  if (recheck) {
    const previous = JSON.parse(await readFile(arg, "utf-8")) as ResearchResult;
    input = { topic: previous.topic, context: "" };
    console.log(`[research] recheck topic="${input.topic}"`);
    result = await recheckSources(previous);
  } else {
    input = await resolveInput(arg);
    console.log(`[research] topic="${input.topic}"`);
    result = await researchSources(input);
  }

  let costJpy: number | null = null;
  try {
    const entry = await appendExpense({
      category: "api",
      service: "source-research",
      amountUsd: result.costUsd,
      amountJpy: null,
      description: `一次情報源調査${recheck ? "(再チェック)" : ""} "${input.topic}"(候補${result.checked.length}件、検索${result.usage.webSearches}回)`,
      occurredAt: new Date().toISOString(),
    });
    costJpy = entry.amountJpy;
  } catch (err) {
    console.error(`[research] ledger記帳に失敗しました(要手動記帳 $${result.costUsd.toFixed(4)}): ${err instanceof Error ? err.message : String(err)}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const slug = input.topic.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 60);
  const base = path.join(OUTPUT_DIR, `${result.generatedAt.slice(0, 10)}_${slug}`);
  await writeFile(`${base}.json`, JSON.stringify(result, null, 2), "utf-8");
  await writeFile(`${base}.md`, toMarkdown(result, costJpy), "utf-8");

  const counts = result.checked.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.recommendation]: (acc[r.recommendation] ?? 0) + 1 }), {});
  console.log(`[research] done ${JSON.stringify(counts)} cost=${costJpy ?? "?"}円 out=${base}.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
