import { politeFetch } from "../lib/politeness";
import type { FetchOutcome } from "./types";

// キー順序の揺れなど無害な差分を除去するため、オブジェクトキーを再帰的にソートする
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, v]) => [key, canonicalize(v)]));
  }
  return value;
}

export async function fetchJson(url: string): Promise<FetchOutcome> {
  const result = await politeFetch(url);
  if (!result.body) {
    return { httpStatus: result.status, raw: null, normalized: null, error: result.error };
  }

  const text = result.body.toString("utf-8");
  try {
    const parsed = JSON.parse(text);
    return { httpStatus: result.status, raw: result.body, normalized: JSON.stringify(canonicalize(parsed)) };
  } catch (err) {
    return {
      httpStatus: result.status,
      raw: result.body,
      normalized: null,
      error: `json_parse_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
