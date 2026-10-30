// ハーヴェスト全体のやること(hq/tasks.json)を読み書きする。sugoi-shorts の朝のSlack(reminders.ts)もここから読む
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const HQ_DIR = import.meta.dirname;
const FILE = path.join(HQ_DIR, "tasks.json");

export interface Task {
  id: string;
  who: "owner" | "gm";
  kind: "do" | "decide" | "kaizen";
  project: string;
  from: string;
  text: string;
  done: string | null;
  daily?: boolean;
  weekly?: number;
  // kaizen(改善の案)だけ: 動かす数字と、始めた時の値。npm run pdca が前後を並べる
  measure?: string;
  baseline?: string;
}
interface Tasks { note: string; items: Task[] }

export const todayJst = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const load = async (): Promise<Tasks> => JSON.parse(await readFile(FILE, "utf-8"));

const isDue = (x: Task, date: string) => {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return !x.done && x.from <= date && (x.weekly === undefined || x.weekly === weekday);
};

export async function openTasks(date = todayJst()) {
  const all = (await load()).items.filter((x) => !x.done);
  return { due: all.filter((x) => isDue(x, date)), later: all.filter((x) => x.from > date).sort((a, b) => a.from.localeCompare(b.from)) };
}

const tag = (x: Task) => `[${x.project}${x.kind === "decide" ? "・判断" : x.kind === "kaizen" ? "・改善" : ""}]`;
export const taskLine = (x: Task) => `・${tag(x)} ${x.text}${x.daily || x.weekly !== undefined ? "" : `(${x.from}から)`} {${x.id}}`;

export async function markDone(id: string, memo?: string) {
  const r = await load();
  const x = r.items.find((i) => i.id === id);
  if (!x) throw new Error(`やること ${id} が hq/tasks.json に無い`);
  if (x.daily || x.weekly !== undefined) throw new Error(`${id} は毎日・毎週のやることなので消し込まない(やめるときは hq/tasks.json から外す)`);
  x.done = memo ? `${todayJst()}(${memo})` : todayJst();
  await writeFile(FILE, JSON.stringify(r, null, 2) + "\n", "utf-8");
  return x;
}

if (import.meta.main) {
  const [cmd, id, ...rest] = process.argv.slice(2);
  if (cmd === "done" && id) {
    const x = await markDone(id, rest.join(" ") || undefined);
    console.log(`${x.id}: 済 ${x.done}`);
  } else {
    const { due, later } = await openTasks(cmd ?? todayJst());
    for (const [who, label] of [["owner", "オーナー"], ["gm", "GM"]] as const) {
      const xs = due.filter((x) => x.who === who);
      console.log(`■ ${label}(${xs.length}件)`);
      for (const x of xs) console.log(taskLine(x));
    }
    if (later.length) {
      console.log(`■ これから(${later.length}件)`);
      for (const x of later) console.log(`・${x.from}〜 ${x.who === "owner" ? "オーナー" : "GM"} ${tag(x)} ${x.text.slice(0, 60)}… {${x.id}}`);
    }
  }
}
