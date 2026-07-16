import { politeFetch } from "../lib/politeness";
import type { FetchOutcome } from "./types";

// PDFは本文パースをせず、生バイナリをそのままハッシュ・保存対象とする
export async function fetchPdf(url: string): Promise<FetchOutcome> {
  const result = await politeFetch(url);
  if (!result.body) {
    return { httpStatus: result.status, raw: null, normalized: null, error: result.error };
  }

  return { httpStatus: result.status, raw: result.body, normalized: result.body };
}
