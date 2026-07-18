// X API v2 の Recent search (https://docs.x.com/x-api/posts/search-recent-posts) を
// 呼び出す薄いクライアント。認証情報は環境変数からのみ読み、ハードコードしない。

const SEARCH_RECENT_URL = "https://api.x.com/2/tweets/search/recent";

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

  return {
    tweets: body.data ?? [],
    newestId: body.meta?.newest_id,
    httpStatus: res.status,
  };
}
