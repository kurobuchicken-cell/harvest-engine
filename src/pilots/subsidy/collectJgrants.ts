import { getJson, type ApiSource } from "../../factory/kinds/api";
import type { SubsidyItem } from "./types";
import { normalizeIndustries, normalizePurposes, normalizeRegions } from "./taxonomy";

const API_BASE = "https://api.jgrants-portal.go.jp/exp/v1/public";
// 一覧APIはキーワード(2文字以上)必須で全件一括取得ができないため、補助金名に頻出する語で網羅する
const KEYWORDS = ["補助", "助成", "支援", "事業", "交付", "奨励", "給付", "促進", "対策", "推進"];

interface ListEntry {
  id: string;
  title: string;
  acceptance_end_datetime: string | null;
}

interface Detail {
  id: string;
  title: string;
  institution_name: string | null;
  use_purpose: string | null;
  industry: string | null;
  target_area_search: string | null;
  target_number_of_employees: string | null;
  subsidy_max_limit: number | null;
  acceptance_start_datetime: string | null;
  acceptance_end_datetime: string | null;
  front_subsidy_detail_page_url: string | null;
}

// 一覧APIは"...:00.000Z"、詳細APIは"...:00Z"と表記が異なりうるため時刻値で比較する
function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return Date.parse(a) === Date.parse(b);
}

async function listOpen(): Promise<Map<string, ListEntry>> {
  const found = new Map<string, ListEntry>();
  for (const keyword of KEYWORDS) {
    const params = new URLSearchParams({ keyword, sort: "created_date", order: "DESC", acceptance: "1" });
    const json = await getJson<{ result?: ListEntry[] }>(`${API_BASE}/subsidies?${params}`);
    for (const entry of json.result ?? []) found.set(entry.id, entry);
    console.log(`[jgrants] keyword=${keyword} hits=${json.result?.length ?? 0} unique=${found.size}`);
  }
  return found;
}

function splitSlash(value: string | null): string[] {
  return (value ?? "").split("/").map((s) => s.trim()).filter(Boolean);
}

export function normalizeSourceFields(fields: NonNullable<SubsidyItem["sourceFields"]>) {
  return {
    regions: normalizeRegions(splitSlash(fields.area)),
    industries: normalizeIndustries(splitSlash(fields.industry)),
    purposes: normalizePurposes(splitSlash(fields.purpose)),
  };
}

function toItem(detail: Detail, now: string, prev: SubsidyItem | undefined): SubsidyItem {
  return {
    id: `jgrants:${detail.id}`,
    source: "jgrants",
    title: detail.title,
    url: detail.front_subsidy_detail_page_url ?? `https://www.jgrants-portal.go.jp/subsidy/${detail.id}`,
    institution: detail.institution_name,
    kind: "grant",
    ...normalizeSourceFields({ industry: detail.industry, area: detail.target_area_search, purpose: detail.use_purpose }),
    sourceFields: { industry: detail.industry, area: detail.target_area_search, purpose: detail.use_purpose },
    targetEmployees: detail.target_number_of_employees,
    maxAmountYen: detail.subsidy_max_limit ? detail.subsidy_max_limit : null,
    acceptanceStart: detail.acceptance_start_datetime,
    acceptanceEnd: detail.acceptance_end_datetime,
    publishedAt: prev?.publishedAt ?? null,
    classifiedBy: "source",
    firstSeenAt: prev?.firstSeenAt ?? now,
    lastSeenAt: now,
  };
}

// 受付中の案件のみ取得する。既知の案件は一覧の締切値が変わっていなければ詳細APIを呼ばない
export const jgrantsSource: ApiSource<ListEntry, SubsidyItem> = {
  id: "jgrants",
  list: async () => [...(await listOpen()).values()],
  storeId: (entry) => `jgrants:${entry.id}`,
  isUnchanged: (prev, entry) => !!prev.sourceFields && sameInstant(prev.listAcceptanceEnd ?? null, entry.acceptance_end_datetime),
  touch: (prev, now) => {
    prev.lastSeenAt = now;
  },
  async fetchDetail(entry, prev, now) {
    const json = await getJson<{ result: Detail[] }>(`${API_BASE}/subsidies/id/${entry.id}`);
    return { ...toItem(json.result[0], now, prev), listAcceptanceEnd: entry.acceptance_end_datetime };
  },
  detailIntervalMs: 1000,
};
