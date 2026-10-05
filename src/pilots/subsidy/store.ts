import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { SubsidyItem } from "./types";

const STORE_PATH = path.resolve(process.cwd(), "data", "pilots", "subsidy", "items.json");

export async function loadItems(): Promise<Map<string, SubsidyItem>> {
  try {
    const list = JSON.parse(await readFile(STORE_PATH, "utf-8")) as SubsidyItem[];
    return new Map(list.map((item) => [item.id, item]));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
}

export async function saveItems(items: Map<string, SubsidyItem>): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const list = [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(STORE_PATH, `${JSON.stringify(list, null, 2)}\n`, "utf-8");
}
