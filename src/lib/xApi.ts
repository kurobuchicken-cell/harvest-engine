// X API v2 の Recent search (https://docs.x.com/x-api/posts/search-recent-posts) を
// 呼び出す薄いクライアント。認証情報は環境変数からのみ読み、ハードコードしない。

import { appendExpense } from "./ledger";

const SEARCH_RECENT_URL = "https://api.x.com/2/tweets/search/recent";

// 読み取り課金の概算単価(1件あたり)。正確な請求額はX Developer Portal側で確認すること
const COST_PER_READ_USD = 0.005;

export interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
}

interface XSearchResponse {
  data?: XTweet[];
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
  title?: string;
  detail?: string;
  status?: number;
}

export interface XSearchParams {
  query: string;
  maxResults: number; // X API仕様上10〜100。本実装の呼び出し側は20固定で使う想定
  sinceId?: string;
  bearerToken: string;
}

export interface XSearchResult {
  tweets: XTweet[];
  newestId?: string;
  httpStatus: number;
}

export class XApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "XApiError";
  }
}

export async function searchRecentTweets(params: XSearchParams): Promise<XSearchResult> {
  const { query, maxResults, sinceId, bearerToken } = params;

  const url = new URL(SEARCH_RECENT_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("tweet.fields", "created_at,author_id");
  if (sinceId) {
    url.searchParams.set("since_id", sinceId);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  let body: XSearchResponse;
  try {
    body = (await res.json()) as XSearchResponse;
  } catch {
    throw new XApiError(`X API応答のJSON解析に失敗(status=${res.status})`, res.status);
  }

  if (!res.ok) {
    throw new XApiError(
      `X API検索が失敗(status=${res.status}): ${body.title ?? ""} ${body.detail ?? ""}`.trim(),
      res.status,
    );
  }

  const tweets = body.data ?? [];

  // 呼び出しが成功した直後に必ず記帳する(執行役の指示を待たない)。
  // 0件応答は実際の課金が発生しないため記帳しない。記帳自体の失敗はAPI呼び出しの成功を
  // 妨げないが、黙って握りつぶさずログに残す
  if (tweets.length > 0) {
    try {
      await appendExpense({
        category: "api",
        service: "x-api",
        amountUsd: tweets.length * COST_PER_READ_USD,
        amountJpy: null,
        description: `X検索 "${query}" ${tweets.length}件取得(読み取り課金概算 $${COST_PER_READ_USD}/件)`,
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        `[xApi] ledger記帳に失敗しました(API呼び出し自体は成功済み、要手動確認): query="${query}" error=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    tweets,
    newestId: body.meta?.newest_id,
    httpStatus: res.status,
  };
}
