import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { SourceReport } from "./genre";
import type { RunRecord } from "./history";

// 一覧で見えた件数が直近の中央値のこの割合を下回ったら、パーサー故障・サイト改修を疑う
const DROP_RATIO = 0.5;
const BASELINE_RUNS = 7;
const SAMPLE = 5;

export interface SiteInspection {
  brokenLinks: string[]; // "ページ -> リンク先"
  missingCredit: string[]; // 一次情報リンクか出典表記が欠けた掲載カードを含むページ
  thinPages: string[]; // 掲載カードが1件も無いページ(サイトのトップは除く)
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
}

// 外部の一次情報URLは毎回数百件を取りに行くことになるため対象外。サイト内の相対リンクだけを確かめる
export async function inspectSite(outDir: string): Promise<SiteInspection> {
  const files = await listFiles(outDir);
  const existing = new Set(files.map((f) => path.resolve(f)));
  const result: SiteInspection = { brokenLinks: [], missingCredit: [], thinPages: [] };
  for (const file of files.filter((f) => f.endsWith(".html"))) {
    const rel = path.relative(outDir, file).replaceAll("\\", "/");
    const html = await readFile(file, "utf-8");
    for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const href = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//") || href.startsWith("#")) continue;
      const target = path.resolve(path.dirname(file), decodeURI(href.split(/[?#]/)[0]));
      if (!existing.has(target)) result.brokenLinks.push(`${rel} -> ${href}`);
    }
    const cards = html.match(/<li class="item">[\s\S]*?<\/li>/g) ?? [];
    if (cards.some((card) => !/href="https?:\/\//.test(card) || !card.includes('class="credit"'))) result.missingCredit.push(rel);
    if (cards.length === 0 && rel !== "index.html") result.thinPages.push(rel);
  }
  return result;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectCollectionDrops(sources: SourceReport[], history: RunRecord[]): string[] {
  const anomalies: string[] = [];
  for (const source of sources) {
    if (!source.ok) {
      anomalies.push(`収集失敗: ${source.sourceId}(${source.error ?? "原因不明"})`);
      continue;
    }
    const past = history
      .filter((r) => r.mode !== "generate-only")
      .flatMap((r) => r.sources.filter((s) => s.sourceId === source.sourceId && s.ok && s.seen > 0).map((s) => s.seen))
      .slice(-BASELINE_RUNS);
    if (past.length === 0) continue;
    const base = median(past);
    if (source.seen < base * DROP_RATIO) {
      anomalies.push(`収集件数の急減: ${source.sourceId} ${source.seen}件(直近${past.length}回の中央値${base}件)`);
    }
  }
  return anomalies;
}

export function inspectionAnomalies(site: SiteInspection): string[] {
  const sample = (list: string[]) => list.slice(0, SAMPLE).join(", ") + (list.length > SAMPLE ? " ほか" : "");
  const anomalies: string[] = [];
  if (site.brokenLinks.length > 0) anomalies.push(`リンク切れ ${site.brokenLinks.length}件: ${sample(site.brokenLinks)}`);
  if (site.missingCredit.length > 0) anomalies.push(`一次情報リンク・出典の欠落 ${site.missingCredit.length}ページ: ${sample(site.missingCredit)}`);
  if (site.thinPages.length > 0) anomalies.push(`掲載0件のページ ${site.thinPages.length}件: ${sample(site.thinPages)}`);
  return anomalies;
}
