import type { IncidentAdapter } from "./types";

interface NotionIncidentRaw {
  name?: string;
  title?: string;
  impact?: string;
  status?: string;
  created_at?: string;
  started_at?: string;
  resolved_at?: string;
}

interface NotionStatusResponse {
  status?: { indicator?: string; description?: string };
  incidents?: NotionIncidentRaw[];
}

// Notionの簡易ステータスレスポンスは稼働中はincidentsキー自体を持たない(実物のsnapshotでも確認済み)。
// indicatorが異常を示しているのにincidents配列が無い場合は構造化抽出できないため、
// 0件として握りつぶさずエラーにして見落としを防ぐ
export const parseNotionIncidents: IncidentAdapter = (raw) => {
  const body = raw as NotionStatusResponse;
  const indicator = body.status?.indicator ?? "none";

  if (!Array.isArray(body.incidents)) {
    if (indicator !== "none") {
      throw new Error(`notion: status indicator="${indicator}" but no structured incidents field found`);
    }
    return [];
  }

  return body.incidents.map((incident) => {
    const title = incident.name ?? incident.title;
    if (!title) {
      throw new Error("notion: incident missing name/title");
    }

    const startedRaw = incident.created_at ?? incident.started_at;
    if (!startedRaw) {
      throw new Error(`notion: incident "${title}" missing created_at/started_at`);
    }

    return {
      title,
      severity: incident.impact ?? incident.status ?? null,
      startedAt: new Date(startedRaw),
      resolvedAt: incident.resolved_at ? new Date(incident.resolved_at) : null,
    };
  });
};
