import { prisma } from "./lib/prisma";

export interface StaleSource {
  id: number;
  companyName: string;
  lastFetchedAt: Date | null;
}

// activeなsourceのうち、直近24時間でsnapshotが1件も作られていないものを検出する
export async function findStaleSources(hours = 24): Promise<StaleSource[]> {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  const activeSources = await prisma.source.findMany({ where: { active: true } });

  const stale: StaleSource[] = [];
  for (const source of activeSources) {
    const lastSnapshot = await prisma.snapshot.findFirst({
      where: { sourceId: source.id },
      orderBy: { fetchedAt: "desc" },
    });
    if (!lastSnapshot || lastSnapshot.fetchedAt < threshold) {
      stale.push({ id: source.id, companyName: source.companyName, lastFetchedAt: lastSnapshot?.fetchedAt ?? null });
    }
  }
  return stale;
}

async function main(): Promise<void> {
  const stale = await findStaleSources();
  if (stale.length === 0) {
    console.log("[diagnostics] 24時間以内に全activeソースのsnapshotを確認できました");
  } else {
    console.log(`[diagnostics] 24時間新規snapshotが無いactiveソース: ${stale.length}件`);
    for (const s of stale) {
      console.log(`  - id=${s.id} ${s.companyName} last=${s.lastFetchedAt?.toISOString() ?? "(未巡回)"}`);
    }
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
