import robotsParser from "robots-parser";
import { USER_AGENT } from "./constants";

type Robots = ReturnType<typeof robotsParser>;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間キャッシュ
const cache = new Map<string, { robots: Robots; fetchedAt: number }>();

async function getRobotsForOrigin(origin: string): Promise<Robots> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.robots;
  }

  const robotsUrl = `${origin}/robots.txt`;
  let body = "";
  try {
    const res = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      body = await res.text();
    }
  } catch {
    // robots.txt が取得できない場合は「制限なし」として扱う
    body = "";
  }

  const robots = robotsParser(robotsUrl, body);
  cache.set(origin, { robots, fetchedAt: Date.now() });
  return robots;
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  const robots = await getRobotsForOrigin(origin);
  return robots.isAllowed(url, USER_AGENT) ?? true;
}
