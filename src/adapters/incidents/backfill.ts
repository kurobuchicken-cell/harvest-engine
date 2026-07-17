import { prisma } from "../../lib/prisma";
import { incidentAdapters } from "./registry";
import { parseChangeIncidents } from "./parseChange";

// parseStatus='pending'のうち、アダプタが存在するsourceのchangesをまとめて再パースする(取りこぼし救済用)
async function main(): Promise<void> {
  const companyNames = Object.keys(incidentAdapters);
  const pendingChanges = await prisma.change.findMany({
    where: { parseStatus: "pending", source: { companyName: { in: companyNames } } },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  console.log(`[backfill] 対象changes: ${pendingChanges.length}件`);

  let parsed = 0;
  let failed = 0;
  let created = 0;

  for (const { id } of pendingChanges) {
    const result = await parseChangeIncidents(id);
    if (result.status === "parsed") {
      parsed++;
      created += result.created;
    } else if (result.status === "failed") {
      failed++;
    }
  }

  console.log(`[backfill] parsed=${parsed}件 failed=${failed}件 作成incidents=${created}件`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
