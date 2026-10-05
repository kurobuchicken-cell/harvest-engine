import type { GenerateResult } from "../../factory/genre";
import { escapeHtml, linkList, siteDir, writeSite, type Page } from "../../factory/html";
import type { GachaItem, MakerId } from "./types";
import { LANGUAGES, type Category, type LanguageConfig } from "./languages";

const OUT_DIR = siteDir("gacha");
const MAKERS: MakerId[] = ["bandai", "takaratomy-arts"];

export function slugify(name: string): string {
  const slug = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug) return slug;
  // 英字を含まない作品名(AIが日本語のまま返した等)でもページを作れるよう、名前から決定的なslugを作る
  let h = 0;
  for (const c of name) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return `f-${h.toString(36)}`;
}

// 発売週の並び順。バンダイは「第N週」、タカラトミーアーツは週の開始日から求める。未定は月末扱い
function weekOrder(item: GachaItem): number {
  const week = item.releaseLabelJa.match(/第(\d)週/)?.[1];
  if (week) return Number(week);
  if (item.releaseWeekStart) return Math.ceil(Number(item.releaseWeekStart.slice(8, 10)) / 7);
  return 9;
}

function byRelease(a: GachaItem, b: GachaItem): number {
  return a.releaseMonth.localeCompare(b.releaseMonth) || weekOrder(a) - weekOrder(b) || a.nameJa.localeCompare(b.nameJa, "ja");
}

function releaseLabel(item: GachaItem, lang: LanguageConfig): string {
  if (lang.code === "ja") return item.releaseLabelJa || lang.ui.releaseMonthOnly(item.releaseMonth);
  const week = item.releaseLabelJa.match(/第(\d)週/)?.[1];
  if (week) return lang.ui.releaseFromWeek(item.releaseMonth, Number(week));
  if (item.releaseWeekStart) return lang.ui.releaseWeekOf(item.releaseWeekStart);
  if (item.releaseLabelJa.includes("未定")) return lang.ui.releaseTba;
  return lang.ui.releaseMonthOnly(item.releaseMonth);
}

function displayName(item: GachaItem, lang: LanguageConfig): string {
  return lang.code === "ja" ? item.nameJa : item.translations[lang.code]?.name ?? item.nameJa;
}

// rel: 言語ディレクトリのルート(site/gacha/{lang}/)への相対パス
function itemCard(item: GachaItem, lang: LanguageConfig, rel: string): string {
  const meta = [
    `${lang.ui.release}${lang.ui.labelSep}${escapeHtml(releaseLabel(item, lang))}`,
    item.priceYen ? `${lang.ui.price}${lang.ui.labelSep}¥${item.priceYen.toLocaleString("en-US")}` : "",
    `<a href="${rel}maker/${item.maker}.html">${escapeHtml(lang.makers[item.maker])}</a>`,
    item.category ? escapeHtml(lang.categories[item.category as Category] ?? item.category) : "",
    item.isResale ? `<span class="badge">${escapeHtml(lang.ui.resale)}</span>` : "",
  ].filter(Boolean).join(" ／ ");
  const franchise = item.franchise
    ? `<a class="tag" href="${rel}franchise/${slugify(item.franchise)}.html">${escapeHtml(item.franchise)}</a>`
    : "";
  const original = lang.code === "ja" ? "" : `<div class="original">${escapeHtml(lang.ui.originalName)}${lang.ui.labelSep}<span lang="ja">${escapeHtml(item.nameJa)}</span></div>`;
  return `<li class="item">
  <div class="item-title">${escapeHtml(displayName(item, lang))}</div>
  ${original}
  <div class="meta">${meta}</div>
  <div class="tags">${franchise} <a class="official" href="${escapeHtml(item.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(lang.ui.officialLink)} ↗</a></div>
  <div class="credit">${escapeHtml(lang.ui.sourceCredit[item.maker])}</div>
</li>`;
}

function itemList(items: GachaItem[], lang: LanguageConfig, rel: string): string {
  return `<ul class="items">${[...items].sort(byRelease).map((i) => itemCard(i, lang, rel)).join("\n")}</ul>`;
}

function layout(opts: { lang: LanguageConfig; relPath: string; title: string; description: string; body: string }): string {
  const depth = opts.relPath.split("/").length - 1;
  const rel = "../".repeat(depth); // 言語ルートへの相対
  const alternates = LANGUAGES.map(
    (l) => `<link rel="alternate" hreflang="${l.code}" href="${rel}../${l.code}/${opts.relPath}">`,
  ).join("\n");
  const switcher = LANGUAGES.map((l) =>
    l.code === opts.lang.code ? `<strong>${escapeHtml(l.label)}</strong>` : `<a href="${rel}../${l.code}/${opts.relPath}" hreflang="${l.code}">${escapeHtml(l.label)}</a>`,
  ).join(" · ");
  const ui = opts.lang.ui;
  return `<!doctype html>
<html lang="${opts.lang.code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
${alternates}
<link rel="stylesheet" href="${rel}../style.css">
</head>
<body>
<header><a class="site" href="${rel}index.html">${escapeHtml(ui.siteName)}</a><nav class="langs">${switcher}</nav></header>
<main>
<h1>${escapeHtml(opts.title)}</h1>
${opts.body}
</main>
<footer>
<p>${escapeHtml(ui.disclaimer)}${ui.machineTranslated ? ` ${escapeHtml(ui.machineTranslated)}` : ""}</p>
<p>${MAKERS.map((m) => escapeHtml(ui.sourceCredit[m])).join(" ／ ")}</p>
</footer>
</body>
</html>
`;
}

const STYLE = `:root{--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--accent:#c2185b;--bg:#fff;--tag:#fbeef3}
@media (prefers-color-scheme: dark){:root{--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--accent:#ff7eb3;--bg:#0d1117;--tag:#2a1a22}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif;color:var(--fg);background:var(--bg);line-height:1.65}
header,main,footer{max-width:960px;margin:0 auto;padding:12px 16px}header{border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center}
a{color:var(--accent)}.site{font-weight:700;text-decoration:none}.langs{font-size:.9em}
h1{font-size:1.4em;line-height:1.4}h2{font-size:1.15em;margin-top:2em;border-left:4px solid var(--accent);padding-left:8px}
.items{list-style:none;padding:0}.item{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:8px 0}
.item-title{font-weight:700}.original,.meta,.credit{font-size:.85em;color:var(--muted)}.tags{margin-top:4px;font-size:.9em}
.tag{display:inline-block;font-size:.85em;background:var(--tag);border-radius:999px;padding:1px 10px;margin-right:6px;text-decoration:none}
.badge{border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:0 4px;font-size:.85em}
.links{columns:3 12em;padding-left:1.2em}.count{color:var(--muted);font-size:.85em}
footer{border-top:1px solid var(--line);font-size:.8em;color:var(--muted);margin-top:40px}`;

export async function generateSite(store: Map<string, GachaItem>, now = new Date()): Promise<GenerateResult> {
  const items = [...store.values()];
  const months = [...new Set(items.map((i) => i.releaseMonth))].sort();
  const currentMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(0, 7);
  const upcomingMonths = months.filter((m) => m >= currentMonth);
  const franchises = new Map<string, GachaItem[]>();
  for (const item of items) {
    if (!item.franchise) continue;
    const list = franchises.get(item.franchise) ?? [];
    list.push(item);
    franchises.set(item.franchise, list);
  }
  // 別名の作品が同じslugになった場合にページが上書きされないよう、slugの重複を検出する
  const slugOwners = new Map<string, string>();
  for (const name of franchises.keys()) {
    const slug = slugify(name);
    if (slugOwners.has(slug)) console.warn(`[generate] franchise slug collision: "${slugOwners.get(slug)}" / "${name}" → ${slug}`);
    slugOwners.set(slug, name);
  }

  const pages: Page[] = [];
  for (const lang of LANGUAGES) {
    const ui = lang.ui;
    const add = (relPath: string, title: string, description: string, body: string) =>
      pages.push({ relPath: `${lang.code}/${relPath}`, html: layout({ lang, relPath, title, description, body }) });

    const monthLinks = (rel: string) =>
      linkList([...months].reverse().map((m) => ({ href: `${rel}month/${m}.html`, label: ui.releaseMonthOnly(m), count: items.filter((i) => i.releaseMonth === m).length })));
    const makerLinks = (rel: string) =>
      linkList(MAKERS.map((m) => ({ href: `${rel}maker/${m}.html`, label: lang.makers[m], count: items.filter((i) => i.maker === m).length })));
    const franchiseLinks = (rel: string) =>
      linkList([...franchises.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([f, list]) => ({ href: `${rel}franchise/${slugify(f)}.html`, label: f, count: list.length })));

    add(
      "index.html",
      ui.siteName,
      ui.indexDescription,
      `<p>${escapeHtml(ui.tagline)}</p>
${upcomingMonths.map((m) => `<h2>${escapeHtml(ui.upcoming)} — ${escapeHtml(ui.releaseMonthOnly(m))}</h2>${itemList(items.filter((i) => i.releaseMonth === m), lang, "")}`).join("\n")}
<h2>${escapeHtml(ui.byFranchise)}</h2>${franchiseLinks("")}
<h2>${escapeHtml(ui.byMaker)}</h2>${makerLinks("")}
<h2>${escapeHtml(ui.byMonth)}</h2>${monthLinks("")}`,
    );

    for (const m of months) {
      const list = items.filter((i) => i.releaseMonth === m);
      add(`month/${m}.html`, ui.monthTitle(m), ui.monthDescription(m, list.length), `${itemList(list, lang, "../")}<h2>${escapeHtml(ui.byMonth)}</h2>${monthLinks("../")}`);
    }
    for (const mk of MAKERS) {
      const list = items.filter((i) => i.maker === mk);
      if (list.length === 0) continue;
      add(`maker/${mk}.html`, ui.makerTitle(lang.makers[mk]), ui.makerDescription(lang.makers[mk], list.length), itemList(list, lang, "../"));
    }
    for (const [f, list] of franchises) {
      add(`franchise/${slugify(f)}.html`, ui.franchiseTitle(f), ui.franchiseDescription(f, list.length), `${itemList(list, lang, "../")}<h2>${escapeHtml(ui.byFranchise)}</h2>${franchiseLinks("../")}`);
    }
  }

  const chooser = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Japan Gacha Release Calendar</title>
${LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${l.code}/index.html">`).join("\n")}
<link rel="stylesheet" href="style.css"></head>
<body><main><h1>Japan Gacha Release Calendar</h1><ul>${LANGUAGES.map((l) => `<li><a href="${l.code}/index.html" hreflang="${l.code}">${escapeHtml(l.label)}</a></li>`).join("")}</ul></main></body></html>
`;

  await writeSite(OUT_DIR, pages, { "index.html": chooser, "style.css": STYLE });
  console.log(`[generate] pages=${pages.length + 1} languages=${LANGUAGES.length} items=${items.length} franchises=${franchises.size} out=${OUT_DIR}`);
  return { outDir: OUT_DIR, pages: pages.length + 1, listed: items.length };
}
