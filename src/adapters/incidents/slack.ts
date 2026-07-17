import type { IncidentAdapter } from "./types";

interface SlackIncidentRaw {
  id?: string;
  title?: string;
  name?: string;
  status?: string;
  date_created?: string;
  created_at?: string;
  date_updated?: string;
  updated_at?: string;
}

interface SlackStatusResponse {
  active_incidents?: SlackIncidentRaw[];
}

// Slack Status API(v2.0.0/current)はactive_incidentsキーを常に持つ想定。
// キー自体が無いレスポンス({"message":""}等)は実際に観測されており、想定外形状としてエラーにする
export const parseSlackIncidents: IncidentAdapter = (raw) => {
  const body = raw as SlackStatusResponse;
  if (!Array.isArray(body.active_incidents)) {
    throw new Error("slack: active_incidents field missing (unexpected response shape)");
  }

  return body.active_incidents.map((incident) => {
    const title = incident.title ?? incident.name;
    if (!title) {
      throw new Error(`slack: incident missing title/name (id=${incident.id ?? "unknown"})`);
    }

    const startedRaw = incident.date_created ?? incident.created_at;
    if (!startedRaw) {
      throw new Error(`slack: incident "${title}" missing date_created/created_at`);
    }

    const status = incident.status ?? null;
    const updatedRaw = incident.date_updated ?? incident.updated_at ?? null;

    return {
      title,
      severity: status,
      startedAt: new Date(startedRaw),
      resolvedAt: status === "resolved" && updatedRaw ? new Date(updatedRaw) : null,
    };
  });
};
