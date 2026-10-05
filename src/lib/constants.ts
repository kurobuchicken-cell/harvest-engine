export const USER_AGENT =
  "HarvestEngineBot/0.1 (+https://github.com/kurobuchicken-cell/harvest-engine)";

// 同一ホストへの最大リトライ回数と指数バックオフ間隔(ミリ秒)
export const RETRY_BACKOFF_MS = [1000, 2000, 4000];

// 1回の取得(本文の読み込みまで含む)の上限。応答しないサイトが1つあると巡回全体が止まるため(2026-10-05発見)
export const FETCH_TIMEOUT_MS = 60_000;
export const ROBOTS_TIMEOUT_MS = 15_000;
