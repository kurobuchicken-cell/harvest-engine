import { prisma } from "../lib/prisma";
import { politeFetch } from "../lib/politeness";

interface StatuspageIncident {
  id: string;
  name: string;
  impact: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface StatuspageSummary {
  incidents?: StatuspageIncident[];
}

// Statuspage.io標準の /api/v2/summary.json をパースし、未登録のincidentsだけをDBへ保存する
export async function syncStatuspageIncidents(summaryUrl: string, service: string): Promise<number> {
  const result = await politeFetch(summaryUrl);
  if (!result.body) {
    throw new Error(`statuspage summary fetch failed: ${result.error ?? result.status}`);
  }

  const summary: StatuspageSummary = JSON.parse(result.body.toString("utf-8"));
  let created = 0;

  for (const incident of summary.incidents ?? []) {
    const startedAt = new Date(incident.created_at);
    const existing = await prisma.incident.findFirst({
      where: { service, title: incident.name, startedAt },
    });
    if (existing) continue;

    await prisma.incident.create({
      data: {
        service,
        title: incident.name,
        severity: incident.impact,
        startedAt,
        resolvedAt: incident.resolved_at ? new Date(incident.resolved_at) : null,
      },
    });
    created++;
  }

  return created;
}

async function main(): Promise<void> {
  const [service, url] = process.argv.slice(2);
  if (!service || !url) {
    console.error("Usage: tsx src/adapters/statuspage.ts <service_name> <summary_json_url>");
    process.exitCode = 1;
    return;
  }

  const created = await syncStatuspageIncidents(url, service);
  console.log(`[statuspage] service=${service} 新規incidents=${created}件`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
