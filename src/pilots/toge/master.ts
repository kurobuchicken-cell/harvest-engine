import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReviewRow } from "./passes";
import { PUBLISHERS } from "./sources";
import type { PassMaster } from "./types";

// 使い方: tsx src/pilots/toge/master.ts add
// 要確認の行(data/pilots/toge/review.json)のうち、まだマスタに無い区間を峠マスタ(passes.json)に追加する。
// 追加後はGMがgitの差分で名前・重複を確認してからコミットする(コミットされたものだけが公開・通知の対象)

const MASTER_PATH = path.resolve(__dirname, "passes.json");
const REVIEW_PATH = path.resolve(process.cwd(), "data", "pilots", "toge", "review.json");

export const passId = (key: string) => {
  const [publisherId] = key.split("|");
  return `${publisherId}-${createHash("sha1").update(key).digest("hex").slice(0, 8)}`;
};

function prefectureOf(publisherId: string): string {
  if (publisherId === "hkd") return "北海道";
  const name = PUBLISHERS.find((p) => p.id === publisherId)?.name ?? "";
  return /^(北海道|.+?[都府県])/.exec(name)?.[1] ?? "";
}

// 峠名が本文に無い区間は「路線(区間)」で示す。表示名は後から直してよい(idは変えない)
export function displayName(row: ReviewRow): string {
  if (row.passNames.length > 0) return row.passNames[0];
  const section = row.section.length > 30 ? `${row.section.slice(0, 30)}…` : row.section;
  return `${row.route}(${section})`;
}

export function addCandidates(master: PassMaster[], rows: ReviewRow[]): PassMaster[] {
  const known = new Set(master.flatMap((m) => m.keys));
  const added: PassMaster[] = [];
  for (const row of rows) {
    if (known.has(row.key)) continue;
    known.add(row.key);
    added.push({
      id: passId(row.key),
      name: displayName(row),
      aliases: row.passNames.slice(1),
      prefecture: prefectureOf(row.key.split("|")[0]),
      route: row.route,
      section: row.section,
      keys: [row.key],
    });
  }
  return added;
}

async function main(): Promise<void> {
  if (process.argv[2] !== "add") throw new Error("usage: tsx src/pilots/toge/master.ts add");
  const master = JSON.parse(await readFile(MASTER_PATH, "utf-8")) as PassMaster[];
  const review = JSON.parse(await readFile(REVIEW_PATH, "utf-8")) as { unmatched: ReviewRow[] };
  const added = addCandidates(master, review.unmatched);
  const ids = new Set(master.map((m) => m.id));
  for (const a of added) if (ids.has(a.id)) throw new Error(`id collision: ${a.id}`);
  await writeFile(MASTER_PATH, `${JSON.stringify([...master, ...added], null, 2)}\n`, "utf-8");
  console.log(`[toge-master] added=${added.length} total=${master.length + added.length}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
