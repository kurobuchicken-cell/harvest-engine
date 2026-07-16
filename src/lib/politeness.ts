import { isAllowedByRobots } from "./robots";
import { RETRY_BACKOFF_MS, USER_AGENT } from "./constants";

export interface FetchResult {
  status: number | null;
  body: Buffer | null;
  error?: string;
}

// ホストごとに直列実行するためのキュー(同一ホスト同時1接続)
const hostQueues = new Map<string, Promise<unknown>>();

function enqueueForHost<T>(host: string, task: () => Promise<T>): Promise<T> {
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const run = prev.then(task, task);
  hostQueues.set(
    host,
    run.catch(() => undefined),
  );
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 5xx・429・ネットワークエラーのみ指数バックオフでリトライ(最大3回)。4xxはリトライしない
async function fetchWithRetry(url: string): Promise<FetchResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const body = Buffer.from(await res.arrayBuffer());

      const isRetryableStatus = res.status === 429 || res.status >= 500;
      if (isRetryableStatus && attempt < RETRY_BACKOFF_MS.length) {
        lastError = `http_${res.status}`;
        await sleep(RETRY_BACKOFF_MS[attempt]);
        continue;
      }

      return { status: res.status, body };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < RETRY_BACKOFF_MS.length) {
        await sleep(RETRY_BACKOFF_MS[attempt]);
        continue;
      }
    }
  }

  return { status: null, body: null, error: lastError };
}

export async function politeFetch(url: string): Promise<FetchResult> {
  const allowed = await isAllowedByRobots(url);
  if (!allowed) {
    return { status: null, body: null, error: "disallowed_by_robots_txt" };
  }

  const host = new URL(url).host;
  return enqueueForHost(host, () => fetchWithRetry(url));
}
