export const USER_AGENT =
  "HarvestEngineBot/0.1 (+https://github.com/kurobuchicken-cell/harvest-engine)";

// 同一ホストへの最大リトライ回数と指数バックオフ間隔(ミリ秒)
export const RETRY_BACKOFF_MS = [1000, 2000, 4000];
