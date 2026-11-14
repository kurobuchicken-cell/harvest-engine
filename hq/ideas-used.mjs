// 儲け口の夜の検証が「同じことの繰り返し」を避けるため、これまでの偏りだけを短く出す(全件を読ませるとトークンが件数に比例して増えるため)
import { readFileSync } from "node:fs";

const items = JSON.parse(readFileSync(new URL("./ideas.json", import.meta.url), "utf-8")).items ?? [];
const top = (vals, n = 12) => {
  const c = new Map();
  for (const v of vals.flat().filter(Boolean)) {
    const k = String(v).slice(0, 40);
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}(${v})`).join(" / ") || "記録なし";
};
const lastNight = items.map((x) => x.night).filter(Boolean).sort().at(-1);
const verdicts = top(items.map((x) => x.verdict));

console.log(`# 儲け口の偏り(全${items.length}件・最後の夜 ${lastNight ?? "-"}・判定 ${verdicts})`);
console.log(`・発想の仕方(frame): ${top(items.map((x) => x.frame))}`);
console.log(`・角度(angle の頭): ${top(items.map((x) => (x.angle ?? "").split(/[(（]/)[0]))}`);
console.log(`・捨てた理由の型(dropType): ${top(items.map((x) => x.dropType))}`);
console.log(`・探した場所(where): ${top(items.map((x) => x.where ?? []), 20)}`);
console.log(`・検索語(keywords): ${top(items.map((x) => x.keywords ?? []), 30)}`);
console.log("・直近10件の仮説:");
for (const x of items.slice(-10)) console.log(`  - ${x.night} ${x.verdict} ${String(x.hypothesis ?? "").slice(0, 70)}`);
const keep = items.filter((x) => x.verdict === "keep" || x.verdict === "dig");
if (keep.length) {
  console.log("・残す・途中:");
  for (const x of keep) console.log(`  - ${x.id} ${x.verdict} ${String(x.hypothesis ?? "").slice(0, 80)}`);
}
