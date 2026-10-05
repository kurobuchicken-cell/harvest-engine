import "dotenv/config";
import { AiBudget } from "./ai";
import { detectCollectionDrops, inspectionAnomalies, inspectSite } from "./check";
import type { Genre, SourceReport } from "./genre";
import { appendRun, loadHistory, type RunRecord } from "./history";
import { notifyAnomalies } from "./notify";
import { findGenre, GENRES } from "./registry";
import { loadStore, saveStore } from "./store";

// 使い方: tsx src/factory/run.ts [ジャンル...] [--generate-only] [--no-ai] [--notify]
// --no-ai: AI処理を飛ばす。--generate-only: 収集もせず手元のデータからページだけ作る。--notify: 異常をSlackへ通知する
export async function runGenre(genre: Genre<{ id: string }>, opts: { generateOnly: boolean; noAi: boolean; notify: boolean }): Promise<RunRecord> {
  const startedAt = new Date().toISOString();
  const store = await loadStore(genre.id);
  let sources: SourceReport[] = [];
  let budget: AiBudget | null = null;

  if (!opts.generateOnly) {
    sources = await genre.collect(store);
    await saveStore(genre.id, store);
    if (!opts.noAi && genre.enrich) {
      budget = await AiBudget.load();
      await genre.enrich(store, budget);
      await saveStore(genre.id, store);
    }
  }
  if (genre.prepare) {
    genre.prepare(store);
    await saveStore(genre.id, store);
  }
  const generated = await genre.generate(store, new Date());

  const site = await inspectSite(generated.outDir);
  const history = (await loadHistory()).filter((r) => r.genre === genre.id);
  const anomalies = [
    ...detectCollectionDrops(sources, history),
    ...inspectionAnomalies(site),
    ...(budget?.exceeded ? [`AI費用の上限: ${budget.exceeded}。未処理分は次回以降に回ります`] : []),
  ];
  const record: RunRecord = {
    genre: genre.id,
    startedAt,
    finishedAt: new Date().toISOString(),
    mode: opts.generateOnly ? "generate-only" : opts.noAi ? "no-ai" : "full",
    sources,
    pages: generated.pages,
    listed: generated.listed,
    brokenLinks: site.brokenLinks.length,
    missingCredit: site.missingCredit.length,
    thinPages: site.thinPages.length,
    aiCostJpy: Math.round((budget?.spentJpy ?? 0) * 100) / 100,
    budgetExceeded: budget?.exceeded ?? null,
    anomalies,
  };
  await appendRun(record);

  console.log(
    `[factory] ${genre.id} pages=${record.pages} listed=${record.listed} brokenLinks=${record.brokenLinks} ` +
      `missingCredit=${record.missingCredit} thinPages=${record.thinPages} aiCostJpy=${record.aiCostJpy} anomalies=${anomalies.length}`,
  );
  for (const a of anomalies) console.warn(`[factory] ${genre.id} 異常: ${a}`);
  if (opts.notify && anomalies.length > 0) {
    await notifyAnomalies(
      `出口工場 定期実行: ${genre.id}`,
      anomalies,
      `ページ${record.pages} / 掲載${record.listed}件 / AI費用${record.aiCostJpy}円 / ${record.finishedAt}`,
    );
  }
  return record;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const ids = args.filter((a) => !a.startsWith("--"));
  const genres = ids.length > 0 ? ids.map(findGenre) : GENRES;
  for (const genre of genres) {
    await runGenre(genre, { generateOnly: flags.has("--generate-only"), noAi: flags.has("--no-ai"), notify: flags.has("--notify") });
  }
}

if (require.main === module) {
  main()
    // タイムアウトで打ち切った取得が裏で残っていてもプロセスを確実に終わらせる(定期実行で次回と重ならないように)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
