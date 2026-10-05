import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { PriceNotice } from "./types";

const STORE_PATH = path.resolve(process.cwd(), "data", "pilots", "price", "items.json");

export async function loadItems(): Promise<Map<string, PriceNotice>> {
  try {
    const list = JSON.parse(await readFile(STORE_PATH, "utf-8")) as PriceNotice[];
    return new Map(list.map((item) => [item.id, item]));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
}

export async function saveItems(items: Map<string, PriceNotice>): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const list = [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(STORE_PATH, `${JSON.stringify(list, null, 2)}\n`, "utf-8");
}
