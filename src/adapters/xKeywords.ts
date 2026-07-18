import "dotenv/config";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { computeHash } from "../lib/hash";
import { saveRawSnapshot } from "../lib/storage";
import { searchRecentTweets, XApiError, type XTweet } from "../lib/xApi";
import keywordsConfig from "../../config/xKeywords.json";

// X API v2 Recent search の仕様上10〜100だが、評議会裁定(1回20件)を固定値として厳守する
const MAX_RESULTS_PER_POLL = 20;

// Spending limit相当の安全装置(1): 1回のスクリプト実行で発行するAPI呼び出し数の上限。
// 既定値はキーワード数(=1キーワード1回のみ)。バグで無限ループしても課金が際限なく膨らまない
const MAX_CALLS_PER_RUN = Number(process.env.X_MAX_CALLS_PER_RUN ?? keywordsConfig.keywords.length);

// Spending limit相当の安全装置(2): 月間の累計取得件数のソフトキャップ(任意、未設定なら無効)。
// 専用の集計テーブルは持たず、当月分のSnapshotのraw(gz)を都度読み直して実績を算出する
const MONTHLY_POST_CAP = process.env.X_MONTHLY_POST_CAP ? Number(process.env.X_MONTHLY_POST_CAP) : null;

// Source.companyNameの命名規則。APIキー有効化後にsourcesへ登録する際もこの形式を使うこと
export function companyNameFor(keyword: string): string {
  return `X検索: "${keyword}"`;
}

async function readTweetIdsFromSnapshot(rawPath: string | null): Promise<string[]> {
  if (!rawPath) return [];
  try {
    const absPath = path.resolve(process.cwd(), rawPath);
    const gz = await readFile(absPath);
    const tweets: XTweet[] = JSON.parse(gunzipSync(gz).toString("utf-8"));
    return tweets.map((t) => t.id);
  } catch {
    return [];
  }
}

function maxTweetId(ids: string[]): string | undefined {
  if (ids.length === 0) return undefined;
  return ids.reduce((a, b) => (BigInt(a) > BigInt(b) ? a : b));
}

async function getMonthlyFetchedCount(sourceIds: number[]): Promise<number> {
  if (sourceIds.length === 0) return 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const snapshots = await prisma.snapshot.findMany({
    where: { sourceId: { in: sourceIds }, fetchedAt: { gte: monthStart } },
  });

  let total = 0;
  for (const snap of snapshots) {
    total += (await readTweetIdsFromSnapshot(snap.rawPath)).length;
  }
  return total;
}

interface PollSummary {
  keyword: string;
  status: "ok" | "skipped_no_source" | "skipped_cap" | "no_bearer_token" | "error";
  newTweets: number;
  detail?: string;
}

// キーワードごとのポーリング本体。既存Source/Snapshot/Changeモデルにそのまま乗せる設計
// (専用テーブルは追加しない、詳細はHANDOFF.md参照)。
// Sourceが未登録のキーワードは安全にスキップする(APIキー有効化前の現状はこのパスを通る想定)
export async function pollXKeywords(): Promise<PollSummary[]> {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.warn("[xKeywords] X_BEARER_TOKEN未設定のため全キーワードをスキップします(実装準備段階の想定挙動)");
    return keywordsConfig.keywords.map((k) => ({
      keyword: k.keyword,
      status: "no_bearer_token",
      newTweets: 0,
      detail: "X_BEARER_TOKEN未設定",
    }));
  }

  const sources = await prisma.source.findMany({
    where: { insuranceType: "theme_h", fetchType: "x_search" },
  });
  const sourceIds = sources.map((s) => s.id);

  const summaries: PollSummary[] = [];
  let callsThisRun = 0;

  for (const { keyword } of keywordsConfig.keywords) {
    if (callsThisRun >= MAX_CALLS_PER_RUN) {
      summaries.push({
        keyword,
        status: "skipped_cap",
        newTweets: 0,
        detail: `1回の実行あたりの呼び出し上限(${MAX_CALLS_PER_RUN}件)に到達`,
      });
      continue;
    }

    const source = sources.find((s) => s.companyName === companyNameFor(keyword));
    if (!source) {
      summaries.push({
        keyword,
        status: "skipped_no_source",
        newTweets: 0,
        detail: "sourcesに対応する行が未登録(APIキー有効化・登録後にactive化予定)",
      });
      continue;
    }

    if (MONTHLY_POST_CAP !== null) {
      const usedThisMonth = await getMonthlyFetchedCount(sourceIds);
      if (usedThisMonth >= MONTHLY_POST_CAP) {
        summaries.push({
          keyword,
          status: "skipped_cap",
          newTweets: 0,
          detail: `月間取得上限(${MONTHLY_POST_CAP}件)に到達(今月実績${usedThisMonth}件)`,
        });
        continue;
      }
    }

    const lastSnapshot = await prisma.snapshot.findFirst({
      where: { sourceId: source.id },
      orderBy: { fetchedAt: "desc" },
    });
    const sinceId = maxTweetId(await readTweetIdsFromSnapshot(lastSnapshot?.rawPath ?? null));

    callsThisRun++;
    try {
      const result = await searchRecentTweets({
        query: keyword,
        maxResults: MAX_RESULTS_PER_POLL,
        sinceId,
        bearerToken,
      });

      if (result.tweets.length === 0) {
        summaries.push({ keyword, status: "ok", newTweets: 0 });
        continue;
      }

      const fetchedAt = new Date();
      const raw = Buffer.from(JSON.stringify(result.tweets), "utf-8");
      const contentHash = computeHash(JSON.stringify(result.tweets.map((t) => t.id).sort()));
      const rawPath = await saveRawSnapshot(source.id, fetchedAt, raw);

      const snapshot = await prisma.snapshot.create({
        data: { sourceId: source.id, fetchedAt, httpStatus: result.httpStatus, contentHash, rawPath },
      });

      await prisma.change.create({
        data: {
          sourceId: source.id,
          detectedAt: fetchedAt,
          prevSnapshotId: lastSnapshot?.id ?? null,
          newSnapshotId: snapshot.id,
          parseStatus: "pending",
        },
      });

      summaries.push({ keyword, status: "ok", newTweets: result.tweets.length });
    } catch (err) {
      const detail = err instanceof XApiError ? err.message : err instanceof Error ? err.message : String(err);
      summaries.push({ keyword, status: "error", newTweets: 0, detail });
      console.error(`[xKeywords] keyword="${keyword}" error: ${detail}`);
    }
  }

  return summaries;
}

if (require.main === module) {
  pollXKeywords()
    .then((summaries) => {
      for (const s of summaries) {
        console.log(`[xKeywords] "${s.keyword}": ${s.status} newTweets=${s.newTweets}${s.detail ? ` (${s.detail})` : ""}`);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
