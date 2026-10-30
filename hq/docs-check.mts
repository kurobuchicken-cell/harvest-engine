// 情報の地図(グローバル CLAUDE.md「情報の置き場所」)が崩れていないかを機械で見る。週1の振り返りと整理のあとに流す
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEV = path.resolve(import.meta.dirname, "..", "..");
const p = (...xs: string[]) => path.join(DEV, ...xs);

// 決まりを持つファイルと文字数の上限(読む量を抑えるため。超えたら経緯を HISTORY.md へ移す)
const RULE_FILES: [string, number][] = [
  [p("dev-config", "CLAUDE.md"), 20000],
  [p("harvest-engine", "CLAUDE.md"), 15000],
  [p("harvest-engine", "RULES.md"), 6000],
  [p("harvest-engine", "GOVERNANCE.md"), 6000],
  [p("harvest-engine", "HANDOFF.md"), 6000],
  [p("sugoi-shorts", "CLAUDE.md"), 8000],
  [p("sugoi-shorts", "仕様書_sugoi-shorts.html"), 40000],
  [p("sugoi-shorts", "src", "autorun-prompt.md"), 12000],
  [p("sugoi-shorts", "src", "autorun-neta.md"), 12000],
];
const skillDir = p("sugoi-shorts", ".claude", "skills");
for (const d of await readdir(skillDir)) RULE_FILES.push([path.join(skillDir, d, "SKILL.md"), 12000]);

const read = (f: string) => readFile(f, "utf-8").catch(() => null);
// HTML は、行の途中の強調(b・code など)で文が切れないよう、まず行の中のタグを外してから、残りのタグを改行にする
const plain = (s: string, f: string) =>
  f.endsWith(".html")
    ? s.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "").replace(/<\/?(b|strong|code|em|i|a|span)(\s[^>]*)?>/g, "").replace(/<[^>]+>/g, "\n")
    : s;
const rel = (f: string) => path.relative(DEV, f);

const problems: string[] = [];
const sentences = new Map<string, Set<string>>();
for (const [f, limit] of RULE_FILES) {
  const raw = await read(f);
  if (raw === null) { problems.push(`無い: ${rel(f)}`); continue; }
  const text = plain(raw, f);
  const n = text.replace(/\s/g, "").length;
  if (n > limit) problems.push(`字数超え: ${rel(f)} ${n}字(上限 ${limit})`);
  for (const s of text.split(/[。\n]/)) {
    const k = s.replace(/[\s*`#>|-]/g, "");
    if (k.length >= 30) (sentences.get(k) ?? sentences.set(k, new Set()).get(k)!).add(rel(f));
  }
}

// HANDOFF は今の状態と次にやることだけ。やることは hq/tasks.json、済んだ記録は Git と HISTORY.md が持つ
const handoff = (await read(p("harvest-engine", "HANDOFF.md"))) ?? "";
for (const l of handoff.split(/\r?\n/)) {
  if (/^#+ .*(やること|宿題|最初にやる)/.test(l)) problems.push(`HANDOFF にやることの節: ${l.trim()}(hq/tasks.json へ)`);
  if (/~~.+~~/.test(l)) problems.push(`HANDOFF に済んだ記録: ${l.trim().slice(0, 60)}`);
}

// やることの置き場は1か所
for (const old of [p("sugoi-shorts", "reminders.json")]) if ((await read(old)) !== null) problems.push(`古いやることの置き場が残っている: ${rel(old)}`);
const tasks = JSON.parse((await read(p("harvest-engine", "hq", "tasks.json"))) ?? '{"items":[]}');
const ids = new Set<string>();
for (const x of tasks.items) {
  if (ids.has(x.id)) problems.push(`tasks.json の id が重複: ${x.id}`);
  ids.add(x.id);
  if (!["owner", "gm"].includes(x.who) || !["do", "decide", "kaizen"].includes(x.kind) || !/^\d{4}-\d\d-\d\d$/.test(x.from)) problems.push(`tasks.json の形が違う: ${x.id}`);
  if (x.kind === "kaizen" && !x.done && (!x.measure || !x.baseline)) problems.push(`改善の案に動かす数字か今の値が無い: ${x.id}`);
}

// 言い回しが違う写しを拾う: 話題ごとに正本のファイルを決め、ほかの決まりのファイルがその話題を(正本を指す行以外で)書いていたら出す
// [話題, 正本のファイル(複数可), 正本以外でも許す行(正本を指す行・別の話題の行)]
const TOPICS: [RegExp, string[], RegExp][] = [
  [/Perplexity.{0,24}(ブラウザ|Pro|個人向け|使わない|使ってよい|preset)/, ["sugoi-shorts/CLAUDE.md", "harvest-engine/RULES.md"], /CLAUDE\.md「調べもの」|RULES\.md/],
  [/推測で(答え|言わ|書か)/, ["dev-config/CLAUDE.md"], /「確かめてから言う」/],
  [/スマホ|ブラウザで出来る|ブラウザでできる/, ["dev-config/CLAUDE.md"], /「ブラウザとスマホ」|スマホ・ドライブ経由の手投稿はしない|スマホからの手での投稿|スマホのアプリでしか|パソコン→スマホ|パソコンやスマホ/],
  [/「投稿する」|公開ボタン|公開のボタン|シェア」?(も|は) ?GM|シェア.{0,6}押す/, ["sugoi-shorts/.claude/skills/episode-post/SKILL.md"], /episode-post|⏸ ?公開|最後の送信／公開ボタン/],
  [/HANDOFF\.md ?(には|は)/, ["dev-config/CLAUDE.md"], /「情報の置き場所」|記録から出せない今の状態だけ/],
];
for (const [re, owners, allow] of TOPICS) {
  for (const [f] of RULE_FILES) {
    if (owners.includes(rel(f).replace(/\\/g, "/"))) continue;
    const raw = await read(f);
    if (!raw) continue;
    const hits = plain(raw, f).split(/\r?\n/).filter((l) => re.test(l) && !allow.test(l));
    if (hits.length) problems.push(`話題「${re.source.slice(0, 20)}」が正本(${owners.join("・")})以外に: ${rel(f)} ${hits.length}行 「${hits[0].trim().slice(0, 50)}…」`);
  }
}

const dups = [...sentences].filter(([, fs]) => fs.size > 1);
for (const [s, fs] of dups.slice(0, 30)) problems.push(`同じ決まりが${fs.size}か所: 「${s.slice(0, 40)}…」 ${[...fs].join("・")}`);
if (dups.length > 30) problems.push(`…ほか同じ文 ${dups.length - 30}件`);

console.log(problems.length ? `docs:check ${problems.length}件\n${problems.map((x) => `・${x}`).join("\n")}` : "docs:check 問題なし");
process.exitCode = problems.length ? 1 : 0;
