import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GenerateResult } from "../../factory/genre";
import { siteDir } from "../../factory/html";
import { detectEvents, NOTIFY_TYPES } from "./events";
import { matchRows, PASSES } from "./passes";
import { PUBLISHERS, SOURCES } from "./sources";
import type { PassState, TogePage } from "./types";

const dataDir = path.resolve(process.cwd(), "data", "pilots", "toge");

// 出典リンクはサイトポリシーの条件ごとに張り分ける(仕様書4-3)。topの発行元はリンクを県のトップページにし、発表元は文字で示す
export function credit(sourceId: string): { label: string; url: string } {
  const source = SOURCES.find((s) => s.id === sourceId)!;
  const publisher = PUBLISHERS.find((p) => p.id === source.publisherId)!;
  const label = `${publisher.name} ${source.office}の発表`;
  if (publisher.linkTarget === "top") return { label, url: `${new URL(publisher.termsUrl).origin}/` };
  return { label, url: source.url! };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf-8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

export async function generateData(store: Map<string, TogePage>, now: Date): Promise<GenerateResult> {
  const nowIso = now.toISOString();
  const { states, unmatched, conflicts } = matchRows([...store.values()], now);

  await mkdir(dataDir, { recursive: true });
  const statePath = path.join(dataDir, "state.json");
  const prev = new Map((await readJson<PassState[]>(statePath, [])).map((s) => [s.passId, s]));
  const events = detectEvents(prev, states, nowIso);
  // 通知の送信は未実装。出来事はログに残すだけ(11〜12月の試運転で中身を確認する)
  for (const e of events) {
    await appendFile(path.join(dataDir, "events.jsonl"), `${JSON.stringify({ ...e, notify: NOTIFY_TYPES.has(e.type) })}\n`, "utf-8");
    console.log(`[toge] event ${e.type} ${e.passId}`);
  }
  // 食い違いで今回採らなかった峠は前回の状態を残す
  const merged = new Map([...prev, ...states]);
  await writeFile(statePath, `${JSON.stringify([...merged.values()], null, 2)}\n`, "utf-8");
  await writeFile(path.join(dataDir, "review.json"), `${JSON.stringify({ generatedAt: nowIso, unmatched, conflicts }, null, 2)}\n`, "utf-8");

  const passes = PASSES.filter((m) => merged.has(m.id)).map((m) => {
    const s = merged.get(m.id)!;
    return {
      id: m.id, name: m.name, aliases: m.aliases, prefecture: m.prefecture, route: m.route, section: m.section, lat: m.lat ?? null, lng: m.lng ?? null,
      status: s.status, closeAt: s.closeAt, reopenAt: s.reopenAt, reopenCertainty: s.reopenCertainty, vehicles: s.vehicles,
      credit: credit(s.sourceId), updatedAt: s.changedAt,
    };
  });
  const outDir = siteDir("toge");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "passes.json"), `${JSON.stringify({ generatedAt: nowIso, passes })}\n`, "utf-8");
  console.log(`[toge] passes=${passes.length} unmatched=${unmatched.length} conflicts=${conflicts.length} events=${events.length}`);
  return { outDir, pages: 0, listed: passes.length };
}
