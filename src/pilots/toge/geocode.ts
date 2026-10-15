import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AiBudget, AiSession, responseText } from "../../factory/ai";
import { USER_AGENT } from "../../lib/constants";
import { PLACES_PATH, type Place } from "./estatPlaces";
import type { PassMaster } from "./types";

// 使い方: tsx src/pilots/toge/geocode.ts [--source estat|ai] [--model haiku|sonnet] [--limit N] [--max-jpy N] [--ring-pass N] [--ring-end N]
// --limit: 未処理の峠から均等にN件だけ試す(一致率を少数で確かめてから全件に進むため)
// 緯度経度の無い峠に、国土地理院の地名情報タイル(提供実験、国土地理院コンテンツ利用規約=PDL1.0、基本測量成果ではない)の座標を入れる。
// タイルは場所を指定して取る方式のため、まずAIでおおよその位置を推定し、その周りのタイルだけを取る。推定位置そのものは保存しない
// https://github.com/gsi-cyberjapan/experimental_pni

const MASTER_PATH = path.resolve(__dirname, "passes.json");
const CACHE_DIR = path.resolve(process.cwd(), "data", "pilots", "toge", "gsi-tiles");
const RESULT_PATH = path.resolve(process.cwd(), "data", "pilots", "toge", "geocode-result.json");
// 推定は課金されるため保存して再利用する(2026-10-08の初回はタイル取得中の通信エラーで止まり、推定をやり直す羽目になった)
const ESTIMATE_PATH = path.resolve(process.cwd(), "data", "pilots", "toge", "geocode-estimates.json");
const FETCH_RETRIES = 3;
const TILE_BASE = "https://cyberjapandata.gsi.go.jp/xyz";
const ZOOM = 15;
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
// z15で1枚約1km四方。峠名は全国に少ないため取り違えにくく、起点・終点の地名より広く探す
const RING_PASS = Number(arg("ring-pass", "4"));
const RING_END = Number(arg("ring-end", "3"));
const MODELS: Record<string, { model: string; service: string }> = {
  haiku: { model: "claude-haiku-4-5", service: "pilot-toge-geo-haiku" },
  sonnet: { model: "claude-sonnet-5-5", service: "pilot-toge-geo-sonnet" },
};
const MODEL = MODELS[arg("model", "sonnet")];
const LIMIT = Number(arg("limit", "0"));
const SOURCE = arg("source", "estat");
const REQUEST_INTERVAL_MS = 1000;
const MAX_JPY = Number(arg("max-jpy", "10")); // 実行ごとにオーナー承認の上限を渡す
const BATCH = 30;

type Kind = "experimental_nnfpt" | "experimental_nrpt"; // 自然地名 / 居住地名

interface Guess {
  name: string;
  lat: number;
  lng: number;
}

interface Estimate {
  id: string;
  pass: Guess | null;
  start: Guess | null;
  end: Guess | null;
}

interface Feature {
  geometry: { coordinates: [number, number] };
  properties: { name: string; Aname?: string; type: string };
}

export const tileOf = (lat: number, lng: number) => {
  const n = 2 ** ZOOM;
  const r = (lat * Math.PI) / 180;
  return { x: Math.floor(((lng + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n) };
};

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.normalize("NFKC").replace(/[\s　]/g, "");

// 地名は完全一致を優先し、無ければ「峠」「山」などの接尾を除いた一致を許す(AIが「渋峠」を「渋」と返すことがあるため)
export function matchFeature(features: Feature[], name: string, near: { lat: number; lng: number }): Feature | null {
  const target = norm(name);
  const candidates = features.filter((f) => {
    const names = [f.properties.name, f.properties.Aname ?? ""].map(norm).filter(Boolean);
    return names.some((n) => n === target || (target.length >= 2 && n.replace(/(峠|山|岳|高原)$/, "") === target.replace(/(峠|山|岳|高原)$/, "")));
  });
  if (candidates.length === 0) return null;
  const pos = (f: Feature) => ({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] });
  return candidates.sort((a, b) => distanceKm(pos(a), near) - distanceKm(pos(b), near))[0];
}

let lastRequest = 0;
async function tile(kind: Kind, x: number, y: number): Promise<Feature[]> {
  const file = path.join(CACHE_DIR, kind, `${x}_${y}.json`);
  try {
    return JSON.parse(await readFile(file, "utf-8")) as Feature[];
  } catch {
    // 未取得
  }
  const wait = lastRequest + REQUEST_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  let res: Response | null = null;
  for (let attempt = 1; !res; attempt++) {
    try {
      res = await fetch(`${TILE_BASE}/${kind}/${ZOOM}/${x}/${y}.geojson`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      if (attempt >= FETCH_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  // 地名の無いタイルは404(NoSuchKey)が返る
  let features: Feature[] = [];
  if (res.ok) features = ((await res.json()) as { features: Feature[] }).features;
  else if (res.status !== 404) throw new Error(`tile ${kind} ${x}/${y} status=${res.status}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(features), "utf-8");
  return features;
}

async function locate(guess: Guess, kinds: Kind[], maxRing: number): Promise<{ lat: number; lng: number } | null> {
  const center = tileOf(guess.lat, guess.lng);
  for (let ring = 0; ring <= maxRing; ring++) {
    const features: Feature[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        for (const kind of kinds) features.push(...(await tile(kind, center.x + dx, center.y + dy)));
      }
    }
    const hit = matchFeature(features, guess.name, guess);
    if (hit) return { lng: hit.geometry.coordinates[0], lat: hit.geometry.coordinates[1] };
  }
  return null;
}

const SYSTEM = `日本の道路の冬期閉鎖区間について、地図で位置を探すための手がかりを返す担当者です。
各区間について、次をJSONで返してください。わからないものはnull。
- pass: 峠名・道路の通称が与えられていれば、その峠(または山・高原)の地名と、おおよその緯度経度
- start / end: 区間の起点・終点の地名と、おおよその緯度経度。地名は地図に載る形に短くする
  (例:"鹿角市柳沢"→"柳沢"、"猿払村狩別2928番8地先"→"狩別"、"湯ノ小屋橋"のような橋・ゲート名はそのまま)
緯度経度は数km程度ずれてもよい。必ず日本国内の値にする。`;

const guessSchema = { anyOf: [{ type: "null" }, { type: "object", properties: { name: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } }, required: ["name", "lat", "lng"], additionalProperties: false }] };
const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, pass: guessSchema, start: guessSchema, end: guessSchema }, required: ["id", "pass", "start", "end"], additionalProperties: false },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

async function estimate(passes: PassMaster[]): Promise<Estimate[]> {
  if (passes.length === 0) return [];
  const budget = await AiBudget.load();
  const ai = new AiSession(budget, MODEL.service, MODEL.model);
  const out: Estimate[] = [];
  // 返答の解析で落ちても、それまでの費用は必ず記帳する(2026-10-15、Sonnetの返答が壊れたJSONで止まり未記帳になった)
  try {
    for (let i = 0; i < passes.length; i += BATCH) {
      if (budget.spentJpy >= MAX_JPY) {
        console.warn(`[geocode] 上限${MAX_JPY}円に達したため推定を打ち切り(${out.length}件済み)`);
        break;
      }
      const chunk = passes.slice(i, i + BATCH).map((p) => ({ id: p.id, prefecture: p.prefecture, route: p.route, section: p.section, names: [p.name, ...p.aliases] }));
      const res = await ai.create({
        max_tokens: 16000,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(chunk) }],
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      });
      if (!res) break;
      const text = responseText(res);
      try {
        out.push(...(JSON.parse(text) as { items: Estimate[] }).items);
      } catch (err) {
        console.error(`[geocode] 返答を解析できず飛ばす stop_reason=${res.stop_reason} 先頭=${JSON.stringify(text.slice(0, 300))}`, err);
        continue;
      }
      console.log(`[geocode] estimated ${out.length}/${passes.length} (${Math.round(budget.spentJpy * 10) / 10}円)`);
    }
  } finally {
    await ai.record(`峠の開通通知パイロット: 峠${out.length}件の位置の手がかりを推定(${MODEL.model})`);
  }
  return out;
}

const inJapan = (g: Guess | null): g is Guess => !!g && g.lat > 20 && g.lat < 46 && g.lng > 122 && g.lng < 154;

// 区間の文字列を起点・終点に分ける。「AからBまで」「A～B」の両方がある
export function splitSection(section: string): string[] {
  return section
    .normalize("NFKC")
    .replace(/まで/g, "")
    .split(/から|[~〜～\-－‐―]|→/)
    .map((s) => s.replace(/[()（）「」\s]/g, ""))
    .filter((s) => s.length >= 2);
}

// e-Statの名前は「大字戸倉」「字母子里」、区間は「戸倉」「燧ヶ岳」/「燧ケ岳」のように書き分けるため、比較の前にそろえる
const stripAza = (s: string) => s.replace(/大字|字/g, "").replace(/[ヶケヵ]/g, "ケ");

// 端点の文字列に含まれる大字名のうち最も長いものを採る。市町村名が書かれていればその市町村の中だけで探す(同名の大字の取り違えを防ぐ)
export function findPlace(text: string, places: Place[], cityHint: string | null): { place: Place; city: string } | null {
  const cities = [...new Set(places.map((p) => p.city))].filter((c) => text.includes(c)).sort((a, b) => b.length - a.length);
  const city = cities[0] ?? cityHint;
  if (!city) return null;
  const rest = stripAza(text.slice(text.indexOf(city) >= 0 ? text.indexOf(city) + city.length : 0));
  const hits = places
    .filter((p) => p.city === city)
    .filter((p) => {
      const n = stripAza(p.name);
      return n.length >= 2 && rest.includes(n);
    })
    .sort((a, b) => stripAza(b.name).length - stripAza(a.name).length);
  return hits[0] ? { place: hits[0], city } : null;
}

export function locateByPlaces(m: PassMaster, places: Place[]): { lat: number; lng: number; how: "midpoint" | "endpoint" } | null {
  const inPref = places.filter((p) => p.pref === m.prefecture);
  const ends: Place[] = [];
  let cityHint: string | null = null;
  for (const part of splitSection(m.section)) {
    const hit = findPlace(part, inPref, cityHint);
    if (hit) {
      ends.push(hit.place);
      cityHint = hit.city;
    }
  }
  if (ends.length >= 2 && distanceKm(ends[0], ends[ends.length - 1]) <= 40) {
    const [a, b] = [ends[0], ends[ends.length - 1]];
    return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2, how: "midpoint" };
  }
  return ends[0] ? { lat: ends[0].lat, lng: ends[0].lng, how: "endpoint" } : null;
}

// AIの推定を使わず、e-Statの大字の代表点から区間の位置を出し、峠名があればその近くの国土地理院の地名タイルで峠の代表点に置き換える
async function mainEstat(): Promise<void> {
  const places = JSON.parse(await readFile(PLACES_PATH, "utf-8")) as Place[];
  const master = JSON.parse(await readFile(MASTER_PATH, "utf-8")) as PassMaster[];
  const pending = master.filter((m) => m.lat === undefined);
  const todo = LIMIT > 0 ? pending.slice(0, LIMIT) : pending;
  console.log(`[geocode] 対象 ${todo.length}/${master.length}(e-Stat)`);
  const counts: Record<string, number> = {};
  for (const m of todo) {
    const base = locateByPlaces(m, places);
    let how: string = base?.how ?? "unmatched";
    let point = base ? { lat: base.lat, lng: base.lng } : null;
    const passName = [m.name, ...m.aliases].find((n) => /峠|岳|山|高原|ライン|スカイ/.test(n) && !/[号線]$/.test(n));
    if (point && passName) {
      const refined = await locate({ name: passName, ...point }, ["experimental_nnfpt"], RING_PASS);
      if (refined) {
        point = refined;
        how = "pass";
      }
    }
    if (point) {
      m.lat = Math.round(point.lat * 1e6) / 1e6;
      m.lng = Math.round(point.lng * 1e6) / 1e6;
      m.geo = how as PassMaster["geo"];
    }
    counts[how] = (counts[how] ?? 0) + 1;
    console.log(`[geocode] ${m.id} ${m.name} -> ${how}`);
  }
  await writeFile(MASTER_PATH, `${JSON.stringify(master, null, 2)}\n`, "utf-8");
  console.log(`[geocode] ${JSON.stringify(counts)}`);
}

async function main(): Promise<void> {
  if (SOURCE === "estat") return mainEstat();
  const master = JSON.parse(await readFile(MASTER_PATH, "utf-8")) as PassMaster[];
  const pending = master.filter((m) => m.lat === undefined);
  const todo = LIMIT > 0 ? pending.filter((_, i) => i % Math.max(1, Math.floor(pending.length / LIMIT)) === 0).slice(0, LIMIT) : pending;
  console.log(`[geocode] 対象 ${todo.length}/${master.length}`);
  const saved = JSON.parse(await readFile(ESTIMATE_PATH, "utf-8").catch(() => "[]")) as Estimate[];
  const savedIds = new Set(saved.map((e) => e.id));
  const fresh = await estimate(todo.filter((m) => !savedIds.has(m.id)));
  const estimates = [...saved, ...fresh].filter((e) => todo.some((m) => m.id === e.id));
  await writeFile(ESTIMATE_PATH, `${JSON.stringify([...saved, ...fresh], null, 2)}\n`, "utf-8");
  const results: { id: string; how: string; lat?: number; lng?: number }[] = [];
  for (const e of estimates) {
    const m = master.find((x) => x.id === e.id);
    if (!m) continue;
    let point: { lat: number; lng: number } | null = null;
    let how = "unmatched";
    if (inJapan(e.pass)) {
      point = await locate(e.pass, ["experimental_nnfpt"], RING_PASS);
      if (point) how = "pass";
    }
    if (!point) {
      const ends: { lat: number; lng: number }[] = [];
      for (const g of [e.start, e.end].filter(inJapan)) {
        const p = (await locate(g, ["experimental_nrpt"], RING_END)) ?? (await locate(g, ["experimental_nnfpt"], RING_END));
        if (p) ends.push(p);
      }
      // 起点と終点が離れすぎている場合は取り違えの恐れがあるため片方の端点を使う
      if (ends.length === 2 && distanceKm(ends[0], ends[1]) <= 40) {
        point = { lat: (ends[0].lat + ends[1].lat) / 2, lng: (ends[0].lng + ends[1].lng) / 2 };
        how = "midpoint";
      } else if (ends.length >= 1) {
        point = ends[0];
        how = "endpoint";
      }
    }
    if (point) {
      m.lat = Math.round(point.lat * 1e6) / 1e6;
      m.lng = Math.round(point.lng * 1e6) / 1e6;
      m.geo = how as PassMaster["geo"];
    }
    results.push({ id: e.id, how, ...point });
    console.log(`[geocode] ${m.id} ${m.name} -> ${how}`);
    await writeFile(MASTER_PATH, `${JSON.stringify(master, null, 2)}\n`, "utf-8");
  }
  await writeFile(RESULT_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
  const count = (h: string) => results.filter((r) => r.how === h).length;
  console.log(`[geocode] pass=${count("pass")} midpoint=${count("midpoint")} endpoint=${count("endpoint")} unmatched=${count("unmatched")}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
