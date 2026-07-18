import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const CHECKLIST_PATH = path.resolve(process.cwd(), "data", "legalChecklist.json");

export type ChecklistItemKey = "robotsTxt" | "tos" | "disclaimer" | "trademark" | "lawyer";

export interface ChecklistItemStatus {
  done: boolean;
  confirmedAt: string | null;
  note: string | null;
}

export interface ThemeChecklist {
  themeId: string;
  themeName: string;
  robotsTxt: ChecklistItemStatus;
  tos: ChecklistItemStatus;
  disclaimer: ChecklistItemStatus;
  trademark: ChecklistItemStatus;
  lawyer: ChecklistItemStatus;
  updatedAt: string;
}

// GOVERNANCE.md「法務ゲート」の2段階に対応する必須項目
// 出口Lite(第2.5層)昇格: robots.txt/ToS/免責/商標の一次審査
export const EXIT_LITE_REQUIRED: ChecklistItemKey[] = ["robotsTxt", "tos", "disclaimer", "trademark"];
// フル出口(第3層)昇格: 上記に加えて人間弁護士のスポット相談が必須
export const FULL_EXIT_REQUIRED: ChecklistItemKey[] = [...EXIT_LITE_REQUIRED, "lawyer"];

const EMPTY_ITEM: ChecklistItemStatus = { done: false, confirmedAt: null, note: null };

function emptyChecklist(themeId: string, themeName: string): ThemeChecklist {
  return {
    themeId,
    themeName,
    robotsTxt: { ...EMPTY_ITEM },
    tos: { ...EMPTY_ITEM },
    disclaimer: { ...EMPTY_ITEM },
    trademark: { ...EMPTY_ITEM },
    lawyer: { ...EMPTY_ITEM },
    updatedAt: new Date().toISOString(),
  };
}

async function readAll(): Promise<Record<string, ThemeChecklist>> {
  try {
    const text = await readFile(CHECKLIST_PATH, "utf-8");
    return JSON.parse(text) as Record<string, ThemeChecklist>;
  } catch {
    return {};
  }
}

async function writeAll(data: Record<string, ThemeChecklist>): Promise<void> {
  await mkdir(path.dirname(CHECKLIST_PATH), { recursive: true });
  await writeFile(CHECKLIST_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function getThemeChecklist(themeId: string): Promise<ThemeChecklist | null> {
  const all = await readAll();
  return all[themeId] ?? null;
}

export async function getAllChecklists(): Promise<Record<string, ThemeChecklist>> {
  return readAll();
}

// 各項目の完了記録は人間(GM/オーナー)が実際に確認した事実を明示的に記録する行為であり、
// robots.txt判定のようにコードが自動検知できるものではない。このため経理部の自動記帳とは
// 異なり「記録し忘れれば素通りする」性質が残る。それでも判定基準を明文化し、legal:checkで
// 都度PASS/FAILを機械的に確認できるようにすることで、判断の根拠を残す仕組みとする
export async function recordChecklistItem(
  themeId: string,
  themeName: string,
  item: ChecklistItemKey,
  note?: string,
): Promise<ThemeChecklist> {
  const all = await readAll();
  const existing = all[themeId] ?? emptyChecklist(themeId, themeName);
  existing.themeName = themeName;
  existing[item] = {
    done: true,
    confirmedAt: new Date().toISOString(),
    note: note ?? null,
  };
  existing.updatedAt = new Date().toISOString();
  all[themeId] = existing;
  await writeAll(all);
  return existing;
}

export function isLayerReady(checklist: ThemeChecklist | null, required: ChecklistItemKey[]): boolean {
  if (!checklist) return false;
  return required.every((key) => checklist[key].done);
}
