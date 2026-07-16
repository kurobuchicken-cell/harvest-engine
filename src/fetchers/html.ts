import { politeFetch } from "../lib/politeness";
import type { FetchOutcome } from "./types";

// 空白の揺れ・HTMLコメントなど無害な差分を除去し、実質的な内容変化だけを検知しやすくする
function normalizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchHtml(url: string): Promise<FetchOutcome> {
  const result = await politeFetch(url);
  if (!result.body) {
    return { httpStatus: result.status, raw: null, normalized: null, error: result.error };
  }

  const html = result.body.toString("utf-8");
  return { httpStatus: result.status, raw: result.body, normalized: normalizeHtml(html) };
}
