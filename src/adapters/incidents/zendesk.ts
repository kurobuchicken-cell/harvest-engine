import type { IncidentAdapter } from "./types";

interface ZendeskAttributes {
  name?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  resolvedAt?: string;
  resolved_at?: string;
}

interface ZendeskDataItem {
  id?: string;
  attributes?: ZendeskAttributes;
}

interface ZendeskResponse {
  data?: ZendeskDataItem[];
}

// Zendesk Status API(/api/incidents/active)はJSON:API形式(data/included)。
// includedは関連リソース(コンポーネント等)でincident本体の抽出には使わない
export const parseZendeskIncidents: IncidentAdapter = (raw) => {
  const body = raw as ZendeskResponse;
  if (!Array.isArray(body.data)) {
    throw new Error("zendesk: data field missing (unexpected response shape)");
  }

  return body.data.map((item) => {
    const attrs = item.attributes ?? {};
    const title = attrs.title ?? attrs.name;
    if (!title) {
      throw new Error(`zendesk: incident missing title/name (id=${item.id ?? "unknown"})`);
    }

    const startedRaw = attrs.createdAt ?? attrs.created_at;
    if (!startedRaw) {
      throw new Error(`zendesk: incident "${title}" missing createdAt/created_at`);
    }

    const status = attrs.status ?? null;
    const resolvedRaw =
      attrs.resolvedAt ?? attrs.resolved_at ?? (status === "resolved" ? attrs.updatedAt ?? attrs.updated_at : undefined);

    return {
      title,
      severity: status,
      startedAt: new Date(startedRaw),
      resolvedAt: resolvedRaw ? new Date(resolvedRaw) : null,
    };
  });
};
