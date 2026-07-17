import { prisma } from "../../lib/prisma";
import { incidentAdapters } from "./registry";
import { loadChangeRaw } from "./parseChange";

// Incident.sourceUrl列追加(2026-07-17)時点で既に作成済みのincidentにsourceUrlを後追いで
// 埋めるための一回限りのバックフィル。parseStatus='parsed'のchangeを再パースし、
// service+title+startedAtが一致する既存incident(sourceUrl未設定のもの)だけをUPDATEする
// (新規incidentの作成はparseChangeIncidents/backfill.tsの役目でありここでは行わない)
async function main(): Promise<void> {
  const companyNames = Object.keys(incidentAdapters);
  const parsedChanges = await prisma.change.findMany({
    where: { parseStatus: "parsed", source: { companyName: { in: companyNames } } },
    include: { source: true, newSnapshot: true },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  for (const change of parsedChanges) {
    const adapter = incidentAdapters[change.source.companyName];
    if (!adapter) continue;

    let parsedIncidents;
    try {
      const raw = await loadChangeRaw(change);
      parsedIncidents = await adapter(raw);
    } catch (err) {
      console.error(`[backfill-source-url] change=${change.id} source=${change.source.companyName} skip: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    for (const incident of parsedIncidents) {
      if (!incident.sourceUrl) continue;
      const result = await prisma.incident.updateMany({
        where: {
          service: change.source.companyName,
          title: incident.title,
          startedAt: incident.startedAt,
          sourceUrl: null,
        },
        data: { sourceUrl: incident.sourceUrl },
      });
      updated += result.count;
    }
  }

  console.log(`[backfill-source-url] updated=${updated}件`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
