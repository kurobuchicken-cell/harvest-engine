import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { SourceReport } from "./genre";

const HISTORY_PATH = path.resolve(process.cwd(), "data", "factory", "runs.json");
const KEEP_PER_GENRE = 90;

export interface RunRecord {
  genre: string;
  startedAt: string;
  finishedAt: string;
  mode: "full" | "no-ai" | "generate-only";
  sources: SourceReport[]; // generate-onlyでは空
  pages: number;
  listed: number;
  brokenLinks: number;
  missingCredit: number;
  thinPages: number;
  aiCostJpy: number;
  budgetExceeded: string | null;
  anomalies: string[];
}

export async function loadHistory(): Promise<RunRecord[]> {
  try {
    return JSON.parse(await readFile(HISTORY_PATH, "utf-8")) as RunRecord[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function appendRun(record: RunRecord): Promise<void> {
  const all = [...(await loadHistory()), record];
  const kept = all.filter((r, i) => all.slice(i + 1).filter((later) => later.genre === r.genre).length < KEEP_PER_GENRE);
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, `${JSON.stringify(kept, null, 2)}\n`, "utf-8");
}
