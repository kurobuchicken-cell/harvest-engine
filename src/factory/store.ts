import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const storePath = (genreId: string) => path.resolve(process.cwd(), "data", "pilots", genreId, "items.json");

export async function loadStore<T extends { id: string }>(genreId: string): Promise<Map<string, T>> {
  try {
    const list = JSON.parse(await readFile(storePath(genreId), "utf-8")) as T[];
    return new Map(list.map((item) => [item.id, item]));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }
}

export async function saveStore<T extends { id: string }>(genreId: string, items: Map<string, T>): Promise<void> {
  const file = storePath(genreId);
  await mkdir(path.dirname(file), { recursive: true });
  const list = [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, "utf-8");
}
