import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RAW_DIR = path.resolve(process.cwd(), "data", "raw");

// 変化検知時のみ呼び出す。/data/raw/{source_id}/{ISO日時}.gz に生データを保存する
export async function saveRawSnapshot(sourceId: number, fetchedAt: Date, raw: Buffer): Promise<string> {
  const dir = path.join(RAW_DIR, String(sourceId));
  await mkdir(dir, { recursive: true });

  const filename = `${fetchedAt.toISOString().replace(/[:.]/g, "-")}.gz`;
  const filePath = path.join(dir, filename);
  await writeFile(filePath, gzipSync(raw));

  return path.relative(process.cwd(), filePath);
}
