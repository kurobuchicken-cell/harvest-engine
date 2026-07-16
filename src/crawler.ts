import { prisma } from "./lib/prisma";
import { fetchByType } from "./fetchers";
import { computeHash } from "./lib/hash";
import { saveRawSnapshot } from "./lib/storage";
import type { SourceModel } from "../generated/prisma/models/Source";
import type { SnapshotModel } from "../generated/prisma/models/Snapshot";

async function getDueSources(): Promise<{ source: SourceModel; lastSnapshot: SnapshotModel | null }[]> {
  const sources = await prisma.source.findMany({ where: { active: true } });
  const now = Date.now();

  const due: { source: SourceModel; lastSnapshot: SnapshotModel | null }[] = [];
  for (const source of sources) {
    const lastSnapshot = await prisma.snapshot.findFirst({
      where: { sourceId: source.id },
      orderBy: { fetchedAt: "desc" },
    });
    const dueAt = lastSnapshot ? lastSnapshot.fetchedAt.getTime() + source.fetchIntervalMin * 60_000 : 0;
    if (now >= dueAt) {
      due.push({ source, lastSnapshot });
    }
  }
  return due;
}

export async function crawlSource(source: SourceModel, lastSnapshot: SnapshotModel | null): Promise<void> {
  const fetchedAt = new Date();
  const outcome = await fetchByType(source.fetchType, source.url);

  const contentHash = outcome.normalized ? computeHash(outcome.normalized) : null;
  const changed = contentHash !== null && contentHash !== lastSnapshot?.contentHash;

  let rawPath: string | null = null;
  if (changed && outcome.raw) {
    rawPath = await saveRawSnapshot(source.id, fetchedAt, outcome.raw);
  }

  const snapshot = await prisma.snapshot.create({
    data: {
      sourceId: source.id,
      fetchedAt,
      httpStatus: outcome.httpStatus,
      contentHash,
      rawPath,
    },
  });

  if (changed) {
    await prisma.change.create({
      data: {
        sourceId: source.id,
        detectedAt: fetchedAt,
        prevSnapshotId: lastSnapshot?.id ?? null,
        newSnapshotId: snapshot.id,
        parseStatus: "pending",
      },
    });
  }

  if (outcome.error) {
    console.warn(`[crawler] source=${source.id}(${source.companyName}) error=${outcome.error}`);
  }
}

export async function crawlAllDue(): Promise<void> {
  const due = await getDueSources();
  console.log(`[crawler] 巡回対象: ${due.length}件`);

  const results = await Promise.allSettled(
    due.map(({ source, lastSnapshot }) => crawlSource(source, lastSnapshot)),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[crawler] ${failed.length}件が例外で失敗しました`);
  }
}

if (require.main === module) {
  crawlAllDue()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
