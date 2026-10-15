import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// 使い方: tsx src/pilots/toge/estatPlaces.ts <GMLを展開したフォルダ>
// e-Statの国勢調査(令和2年)小地域境界データ(GML、世界測地系緯度経度)から、大字・町丁の名前と代表点だけを抜き出す。
// 峠の区間の起点・終点はほとんどが大字名で書かれるため、峠の位置を名前で引く台帳に使う(geocode.ts --source estat)。
// 利用条件はe-Statの利用規約(出典を記載すれば商用可、加工した旨を記載)。https://www.e-stat.go.jp/terms-of-use
// 取得元: https://www.e-stat.go.jp/gis/statmap-search?type=2 (都道府県ごとにdlserveyId=A002005212020&format=gml&datum=2011)

export interface Place {
  pref: string;
  city: string;
  name: string;
  lat: number;
  lng: number;
}

export const PLACES_PATH = path.resolve(process.cwd(), "data", "pilots", "toge", "estat-places.json");

const FEATURE_RE =
  /<fme:PREF_NAME>([^<]*)<\/fme:PREF_NAME>[\s\S]*?<fme:CITY_NAME>([^<]*)<\/fme:CITY_NAME>[\s\S]*?<fme:S_NAME>([^<]*)<\/fme:S_NAME>[\s\S]*?<fme:X_CODE>([^<]*)<\/fme:X_CODE>\s*<fme:Y_CODE>([^<]*)<\/fme:Y_CODE>/g;

export function parseGml(gml: string): Place[] {
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const m of gml.matchAll(FEATURE_RE)) {
    const [, pref, city, name, x, y] = m;
    // 1つの大字が調査区で複数の面に分かれて載るため、同じ名前は最初の代表点だけ残す
    const key = `${pref}|${city}|${name}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    places.push({ pref, city, name, lat: Number(y), lng: Number(x) });
  }
  return places;
}

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) throw new Error("usage: tsx src/pilots/toge/estatPlaces.ts <dir>");
  const places: Place[] = [];
  for (const sub of (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    for (const file of (await readdir(path.join(dir, sub.name))).filter((f) => f.endsWith(".gml"))) {
      const found = parseGml(await readFile(path.join(dir, sub.name, file), "utf-8"));
      places.push(...found);
      console.log(`[estat] ${file} places=${found.length}`);
    }
  }
  await writeFile(PLACES_PATH, JSON.stringify(places), "utf-8");
  console.log(`[estat] total=${places.length} -> ${PLACES_PATH}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
