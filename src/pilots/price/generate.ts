import type { GenerateResult } from "../../factory/genre";
import { escapeHtml, linkList, siteDir, writeSite, type Page } from "../../factory/html";
import type { PriceNotice } from "./types";
import { SOURCES } from "./sources";
import { CATEGORIES } from "./analyze";

const OUT_DIR = siteDir("price");
// 値下げの告知は載せない。内容量だけの変更は「実質値上げ」、方向が本文から判断できない価格改定は値上げと断定せず載せる
const LISTED_DIRECTIONS = new Set(["increase", "mixed", "size_only", "other"]);
const categorySlug = new Map(CATEGORIES.map((c) => [c.name, c.slug]));

function jstDate(iso: string | null): string {
  if (!iso) return "不明";
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
}

const jstMonth = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(0, 7);
const monthLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;

function byEffective(a: PriceNotice, b: PriceNotice): number {
  return (a.effectiveAt ?? "9999").localeCompare(b.effectiveAt ?? "9999") || a.company.localeCompare(b.company, "ja");
}

function card(n: PriceNotice, rel: string): string {
  const meta = [
    `実施 ${escapeHtml(jstDate(n.effectiveAt))}`,
    n.rateText ? `改定率 ${escapeHtml(n.rateText)}` : "",
    `発表 ${escapeHtml(jstDate(n.announcedAt))}`,
    n.direction === "size_only" ? `<span class="badge">内容量変更(実質値上げ)</span>` : n.sizeChange ? `<span class="badge">内容量変更あり</span>` : "",
    n.direction === "other" ? `<span class="badge">改定内容は一次情報を参照</span>` : "",
  ].filter(Boolean).join(" ／ ");
  const cats = n.categories
    .map((c) => `<a class="tag" href="${rel}category/${categorySlug.get(c)}.html">${escapeHtml(c)}</a>`)
    .join("");
  const brands = n.brands.length > 0 ? `<div class="brands">対象: ${n.brands.map(escapeHtml).join("、")}</div>` : "";
  return `<li class="item">
  <div class="item-title"><a href="${rel}company/${n.sourceId}.html">${escapeHtml(n.company)}</a>：${escapeHtml(n.title ?? "価格改定")}</div>
  <div class="meta">${meta}</div>
  ${n.summary ? `<p class="summary">${escapeHtml(n.summary)}</p>` : ""}
  ${brands}
  <div class="tags">${cats} <a class="primary" href="${escapeHtml(n.url)}" rel="nofollow noopener" target="_blank">ニュースリリース（一次情報）↗</a></div>
  <div class="credit">出典：${escapeHtml(n.company)} ニュースリリース</div>
</li>`;
}

const list = (items: PriceNotice[], rel: string) =>
  items.length === 0 ? `<p class="empty">該当する告知はありません。</p>` : `<ul class="items">${[...items].sort(byEffective).map((n) => card(n, rel)).join("\n")}</ul>`;

function layout(title: string, description: string, rel: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="stylesheet" href="${rel}style.css">
</head>
<body>
<header><a class="site" href="${rel}index.html">値上げカレンダー（試作版）</a></header>
<main>
<h1>${escapeHtml(title)}</h1>
${body}
</main>
<footer>
<p>各メーカーが公式サイトで発表したニュースリリースをもとに、実施日・改定率・対象などの事実を自動で整理した非公式の情報です。要約はAIが作成しており、誤りを含む場合があります。正確な内容は必ず各社の一次情報（リンク先）でご確認ください。</p>
</footer>
</body>
</html>
`;
}

const STYLE = `:root{--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--accent:#b4472b;--bg:#fff;--tag:#fbefe9}
@media (prefers-color-scheme: dark){:root{--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--accent:#ff9a76;--bg:#0d1117;--tag:#2b1d17}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif;color:var(--fg);background:var(--bg);line-height:1.7}
header,main,footer{max-width:960px;margin:0 auto;padding:12px 16px}header{border-bottom:1px solid var(--line)}
a{color:var(--accent)}.site{font-weight:700;text-decoration:none}
h1{font-size:1.4em;line-height:1.4}h2{font-size:1.15em;margin-top:2em;border-left:4px solid var(--accent);padding-left:8px}
.items{list-style:none;padding:0}.item{border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0}
.item-title{font-weight:700}.meta,.credit,.brands{font-size:.85em;color:var(--muted)}.summary{margin:6px 0}
.tags{margin-top:4px;font-size:.9em}.tag{display:inline-block;font-size:.85em;background:var(--tag);border-radius:999px;padding:1px 10px;margin-right:6px;text-decoration:none}
.badge{border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:0 4px}
.links{columns:3 12em;padding-left:1.2em}.count{color:var(--muted);font-size:.85em}.empty{color:var(--muted)}
footer{border-top:1px solid var(--line);font-size:.8em;color:var(--muted);margin-top:40px}`;

export async function generateSite(store: Map<string, PriceNotice>, now = new Date()): Promise<GenerateResult> {
  const listed = [...store.values()].filter((n) => n.status === "analyzed" && n.isPriceRevision && LISTED_DIRECTIONS.has(n.direction ?? ""));
  const today = now.toISOString();
  const upcoming = listed.filter((n) => n.effectiveAt && n.effectiveAt >= today);
  const recent = [...listed].sort((a, b) => (b.announcedAt ?? "").localeCompare(a.announcedAt ?? "")).slice(0, 20);
  const months = [...new Set(listed.filter((n) => n.effectiveAt).map((n) => jstMonth(n.effectiveAt!)))].sort().reverse();
  const pages: Page[] = [];

  const monthLinks = (rel: string) =>
    linkList(months.map((m) => ({ href: `${rel}month/${m}.html`, label: `${monthLabel(m)}実施`, count: listed.filter((n) => n.effectiveAt && jstMonth(n.effectiveAt) === m).length })));
  const companyLinks = (rel: string) =>
    linkList(SOURCES.map((s) => ({ href: `${rel}company/${s.id}.html`, label: s.company, count: listed.filter((n) => n.sourceId === s.id).length })));
  const categoryLinks = (rel: string) =>
    linkList(CATEGORIES.map((c) => ({ href: `${rel}category/${c.slug}.html`, label: c.name, count: listed.filter((n) => n.categories.includes(c.name)).length })));

  pages.push({
    relPath: "index.html",
    html: layout(
      "食品・日用品の値上げカレンダー（メーカー発表まとめ）",
      "食品・飲料・日用品メーカーが発表した値上げ(価格改定)を、実施日順・月別・メーカー別・品目別にまとめています。",
      "",
      `<p class="count">更新日：${escapeHtml(jstDate(today))}　掲載 ${listed.length}件（${SOURCES.length}社を監視）</p>
<h2>これから実施される値上げ（${upcoming.length}件）</h2>${list(upcoming, "")}
<h2>最近発表された値上げ</h2><ul class="items">${recent.map((n) => card(n, "")).join("\n")}</ul>
<h2>実施月から探す</h2>${monthLinks("")}
<h2>メーカーから探す</h2>${companyLinks("")}
<h2>品目から探す</h2>${categoryLinks("")}`,
    ),
  });

  for (const m of months) {
    const items = listed.filter((n) => n.effectiveAt && jstMonth(n.effectiveAt) === m);
    pages.push({
      relPath: `month/${m}.html`,
      html: layout(`${monthLabel(m)}に実施される値上げ一覧`, `${monthLabel(m)}に実施される食品・日用品の値上げ${items.length}件をメーカー発表から整理。`, "../", `${list(items, "../")}<h2>実施月から探す</h2>${monthLinks("../")}`),
    });
  }
  for (const s of SOURCES) {
    const items = listed.filter((n) => n.sourceId === s.id);
    if (items.length === 0) continue;
    pages.push({
      relPath: `company/${s.id}.html`,
      html: layout(`${s.company}の値上げ・価格改定一覧`, `${s.company}が発表した値上げ・価格改定${items.length}件を実施日順に掲載。`, "../", `${list(items, "../")}<h2>メーカーから探す</h2>${companyLinks("../")}`),
    });
  }
  for (const c of CATEGORIES) {
    const items = listed.filter((n) => n.categories.includes(c.name));
    if (items.length === 0) continue;
    pages.push({
      relPath: `category/${c.slug}.html`,
      html: layout(`${c.name}の値上げ一覧`, `${c.name}の値上げ・価格改定${items.length}件をメーカー発表から実施日順に掲載。`, "../", `${list(items, "../")}<h2>品目から探す</h2>${categoryLinks("../")}`),
    });
  }

  await writeSite(OUT_DIR, pages, { "style.css": STYLE });
  console.log(`[generate] pages=${pages.length} listed=${listed.length} upcoming=${upcoming.length} out=${OUT_DIR}`);
  return { outDir: OUT_DIR, pages: pages.length, listed: listed.length };
}
