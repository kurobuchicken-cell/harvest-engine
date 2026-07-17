import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { prisma } from "../../lib/prisma";
import { incidentAdapters } from "./registry";
import type { ChangeModel } from "../../../generated/prisma/models/Change";
import type { SourceModel } from "../../../generated/prisma/models/Source";
import type { SnapshotModel } from "../../../generated/prisma/models/Snapshot";

export interface ParseChangeResult {
  status: "parsed" | "failed" | "skipped";
  created: number;
  reason?: string;
}

// rss/htmlはraw本文がそのままテキスト(XML/HTML)であり、jsonのみパース対象が構造化データになる。
// backfillSourceUrl.tsからも同じ読み込みロジックを再利用する
export async function loadChangeRaw(
  change: ChangeModel & { source: SourceModel; newSnapshot: SnapshotModel },
): Promise<unknown> {
  if (!change.newSnapshot.rawPath) {
    throw new Error("newSnapshot.rawPath is empty");
  }
  const filePath = path.resolve(process.cwd(), change.newSnapshot.rawPath);
  const compressed = await readFile(filePath);
  const decompressed = gunzipSync(compressed).toString("utf-8");
  return change.source.fetchType === "json" ? JSON.parse(decompressed) : decompressed;
}

// 1件のChangeをraw snapshotから読み込み、companyNameに対応するアダプタでincidentsへ正規化する。
// 成否に関わらずChange.parseStatusを必ず更新し、エラーは握りつぶさずログに残す
export async function parseChangeIncidents(changeId: number): Promise<ParseChangeResult> {
  const change = await prisma.change.findUnique({
    where: { id: changeId },
    include: { source: true, newSnapshot: true },
  });
  if (!change) {
    throw new Error(`change not found: id=${changeId}`);
  }

  const adapter = incidentAdapters[change.source.companyName];
  if (!adapter) {
    return { status: "skipped", created: 0, reason: `no adapter registered for "${change.source.companyName}"` };
  }

  try {
    const raw = await loadChangeRaw(change);
    const parsedIncidents = await adapter(raw);

    let created = 0;
    for (const incident of parsedIncidents) {
      const existing = await prisma.incident.findFirst({
        where: { service: change.source.companyName, title: incident.title, startedAt: incident.startedAt },
      });
      if (existing) continue;

      await prisma.incident.create({
        data: {
          service: change.source.companyName,
          title: incident.title,
          severity: incident.severity,
          startedAt: incident.startedAt,
          resolvedAt: incident.resolvedAt,
          sourceUrl: incident.sourceUrl,
          sourceChangeId: change.id,
        },
      });
      created++;
    }

    await prisma.change.update({ where: { id: change.id }, data: { parseStatus: "parsed" } });
    return { status: "parsed", created };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[incidents] change=${change.id} source=${change.source.companyName} parse failed: ${reason}`);
    await prisma.change.update({ where: { id: change.id }, data: { parseStatus: "failed" } });
    return { status: "failed", created: 0, reason };
  }
}
