import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SubsidyItem } from "./types";
import { INDUSTRIES, NATIONWIDE, PREFECTURES, PURPOSES } from "./taxonomy";

const OUT_DIR = path.resolve(process.cwd(), "site", "subsidy");
// 締切が取れないJ-Net21案件は掲載日から一定期間だけ表示する(古い告知を載せ続けないため)
const UNDATED_VISIBLE_DAYS = 60;

const NATIONWIDE_SLUG = "zenkoku";
const ANY_INDUSTRY_SLUG = "any";
const regionSlug = new Map<string, string>([
  [NATIONWIDE, NATIONWIDE_SLUG],
  ...PREFECTURES.map((p) => [p.name, p.slug] as [string, string]),
]);
const industrySlug = new Map(INDUSTRIES.map((i) => [i.name, i.slug]));
const purposeSlug = new Map(PURPOSES.map((p) => [p.name, p.slug]));

const SOURCE_CREDIT: Record<SubsidyItem["source"], string> = {
  jgrants: "出典：Jグランツ（デジタル庁）",
  jnet21: "出典：中小機構 J-Net21",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formatDate(iso: string | null): string {
  if (!iso) return "要確認";
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
}

function formatAmount(yen: number | null): string {
  if (!yen) return "";
  return yen >= 10_000 ? `上限${(yen / 10_000).toLocaleString("ja-JP")}万円` : `上限${yen.toLocaleString("ja-JP")}円`;
}

export function isVisible(item: SubsidyItem, now: Date): boolean {
  if (item.classifiedBy === "pending") return false;
  if (item.acceptanceEnd) return new Date(item.acceptanceEnd) >= now;
  const base = item.publishedAt ?? item.firstSeenAt;
  return now.getTime() - new Date(base).getTime() <= UNDATED_VISIBLE_DAYS * 86_400_000;
}

function byDeadline(a: SubsidyItem, b: SubsidyItem): number {
  const ta = a.acceptanceEnd ? Date.parse(a.acceptanceEnd) : Number.MAX_SAFE_INTEGER;
  const tb = b.acceptanceEnd ? Date.parse(b.acceptanceEnd) : Number.MAX_SAFE_INTEGER;
  return ta - tb || a.title.localeCompare(b.title, "ja");
}

// rootRel: そのページからサイトルートへの相対パス("" / "../" / "../../" ...)。file://で開いても辿れるよう相対リンクにする
function itemCard(item: SubsidyItem, rootRel: string): string {
  const tags = [
    ...item.regions.map((r) => `<a class="tag region" href="${rootRel}region/${regionSlug.get(r)}/index.html">${escapeHtml(r)}</a>`),
    ...(item.industries.length === 0 ? [`<a class="tag" href="${rootRel}industry/${ANY_INDUSTRY_SLUG}/index.html">業種を問わない</a>`] : []),
    ...item.industries.map((i) => `<a class="tag" href="${rootRel}industry/${industrySlug.get(i)}/index.html">${escapeHtml(i)}</a>`),
    ...item.purposes.map((p) => `<a class="tag purpose" href="${rootRel}purpose/${purposeSlug.get(p)}/index.html">${escapeHtml(p)}</a>`),
  ].join("");
  const meta = [
    item.kind === "loan" ? "融資" : "補助金・助成金",
    `締切 ${formatDate(item.acceptanceEnd)}`,
    formatAmount(item.maxAmountYen),
    item.targetEmployees ?? "",
    item.institution ?? "",
  ].filter(Boolean).map(escapeHtml).join(" ／ ");
  return `<li class="item">
  <a class="item-title" href="${escapeHtml(item.url)}" rel="nofollow noopener" target="_blank">${escapeHtml(item.title)}</a>
  <div class="meta">${meta}</div>
  <div class="tags">${tags}</div>
  <div class="credit">${SOURCE_CREDIT[item.source]}</div>
</li>`;
}

function itemList(items: SubsidyItem[], rootRel: string): string {
  if (items.length === 0) return `<p class="empty">該当する受付中の案件はありません。</p>`;
  return `<ul class="items">${[...items].sort(byDeadline).map((i) => itemCard(i, rootRel)).join("\n")}</ul>`;
}

function layout(opts: { title: string; description: string; rootRel: string; body: string; breadcrumbs: [string, string | null][] }): string {
  const crumbs = opts.breadcrumbs
    .map(([label, href]) => (href ? `<a href="${href}">${escapeHtml(label)}</a>` : escapeHtml(label)))
    .join(" › ");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
<link rel="stylesheet" href="${opts.rootRel}style.css">
</head>
<body>
<header><a class="site" href="${opts.rootRel}index.html">補助金さがし（試作版）</a></header>
<main>
<nav class="crumbs">${crumbs}</nav>
<h1>${escapeHtml(opts.title)}</h1>
${opts.body}
</main>
<footer>
<p>掲載情報は各出典の公開情報を自動で整理したものです。申請条件・締切は必ずリンク先の公式情報でご確認ください。</p>
<p>出典：Jグランツ（デジタル庁）／ 中小機構 J-Net21</p>
</footer>
</body>
</html>
`;
}

const STYLE = `:root{--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--accent:#0b5cad;--bg:#fff;--tag:#eef3f8}
@media (prefers-color-scheme: dark){:root{--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--accent:#5ea8ff;--bg:#0d1117;--tag:#1c2733}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif;color:var(--fg);background:var(--bg);line-height:1.7}
header,main,footer{max-width:960px;margin:0 auto;padding:12px 16px}header{border-bottom:1px solid var(--line)}
a{color:var(--accent)}.site{font-weight:700;text-decoration:none}.crumbs{font-size:.85em;color:var(--muted)}
h1{font-size:1.4em;line-height:1.4}h2{font-size:1.15em;margin-top:2em;border-left:4px solid var(--accent);padding-left:8px}
.items{list-style:none;padding:0}.item{border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}
.item-title{font-weight:700}.meta,.credit{font-size:.85em;color:var(--muted)}.tags{margin-top:6px}
.tag{display:inline-block;font-size:.78em;background:var(--tag);border-radius:999px;padding:1px 10px;margin:2px 4px 2px 0;text-decoration:none}
.links{columns:3 12em;padding-left:1.2em}.count{color:var(--muted);font-size:.85em}.empty{color:var(--muted)}
footer{border-top:1px solid var(--line);font-size:.8em;color:var(--muted);margin-top:40px}`;

function linkList(entries: { href: string; label: string; count: number }[]): string {
  return `<ul class="links">${entries
    .filter((e) => e.count > 0)
    .map((e) => `<li><a href="${e.href}">${escapeHtml(e.label)}</a> <span class="count">(${e.count})</span></li>`)
    .join("")}</ul>`;
}

interface Page {
  relPath: string;
  html: string;
}

export interface GenerateResult {
  pages: number;
  visibleItems: number;
  comboPages: number;
}

export async function generateSite(store: Map<string, SubsidyItem>, now = new Date()): Promise<GenerateResult> {
  const visible = [...store.values()].filter((i) => isVisible(i, now));
  const nationwide = visible.filter((i) => i.regions.includes(NATIONWIDE));
  const inRegion = (name: string) => visible.filter((i) => i.regions.includes(name));
  const inIndustry = (name: string) => visible.filter((i) => i.industries.includes(name));
  const inPurpose = (name: string) => visible.filter((i) => i.purposes.includes(name));
  const anyIndustry = visible.filter((i) => i.industries.length === 0);
  // 地域ページの「その地域の案件」。都道府県ページには全国対象を混ぜない(全国ページへ誘導する)
  const localOf = (region: string) =>
    region === NATIONWIDE ? nationwide : inRegion(region).filter((i) => !i.regions.includes(NATIONWIDE));
  const pages: Page[] = [];
  const updated = `<p class="count">更新日：${formatDate(now.toISOString())}　受付中・掲載中 ${visible.length}件</p>`;

  const regionEntries = [NATIONWIDE, ...PREFECTURES.map((p) => p.name)].map((r) => ({
    href: `region/${regionSlug.get(r)}/index.html`, label: r, count: inRegion(r).length,
  }));
  const industryEntries = [
    ...INDUSTRIES.map((i) => ({ href: `industry/${i.slug}/index.html`, label: i.name, count: inIndustry(i.name).length })),
    { href: `industry/${ANY_INDUSTRY_SLUG}/index.html`, label: "業種を問わない", count: anyIndustry.length },
  ];
  const purposeEntries = PURPOSES.map((p) => ({ href: `purpose/${p.slug}/index.html`, label: p.name, count: inPurpose(p.name).length }));
  const recent = [...visible].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || byDeadline(a, b)).slice(0, 30);

  pages.push({
    relPath: "index.html",
    html: layout({
      title: "受付中の補助金・助成金を地域・業種・目的からさがす",
      description: "国・都道府県の受付中の補助金・助成金・融資を、地域・業種・目的別に毎日自動で整理しています。",
      rootRel: "",
      breadcrumbs: [["トップ", null]],
      body: `${updated}
<h2>地域からさがす</h2>${linkList(regionEntries)}
<h2>業種からさがす</h2>${linkList(industryEntries)}
<h2>目的からさがす</h2>${linkList(purposeEntries)}
<h2>新着</h2>${itemList(recent, "")}`,
    }),
  });

  // 地域ページ: その地域限定の案件+(都道府県なら)全国対象の案件を分けて載せる
  for (const region of [NATIONWIDE, ...PREFECTURES.map((p) => p.name)]) {
    const local = localOf(region);
    if (local.length === 0 && region !== NATIONWIDE) continue;
    const slug = regionSlug.get(region)!;
    const rootRel = "../../";
    const comboLinks = INDUSTRIES.flatMap((ind) =>
      PURPOSES.map((pur) => ({
        href: `${ind.slug}/${pur.slug}.html`,
        label: `${ind.name} × ${pur.name}`,
        count: local.filter((i) => i.industries.includes(ind.name) && i.purposes.includes(pur.name)).length,
      })),
    );
    const purposeLinks = PURPOSES.map((pur) => ({
      href: `p-${pur.slug}.html`,
      label: pur.name,
      count: local.filter((i) => i.purposes.includes(pur.name)).length,
    }));
    const body = `${updated}
<h2>目的で絞り込む</h2>${linkList(purposeLinks)}
${comboLinks.some((c) => c.count > 0) ? `<h2>業種×目的で絞り込む</h2>${linkList(comboLinks)}` : ""}
<h2>${escapeHtml(region === NATIONWIDE ? "全国対象の案件" : `${region}の案件`)}（${local.length}件）</h2>${itemList(local, rootRel)}
${region === NATIONWIDE ? "" : `<p>このほか、全国を対象とした案件が${nationwide.length}件あります。<a href="${rootRel}region/${NATIONWIDE_SLUG}/index.html">全国対象の案件を見る</a></p>`}`;
    pages.push({
      relPath: `region/${slug}/index.html`,
      html: layout({
        title: `${region}の補助金・助成金一覧（受付中）`,
        description: `${region}で受付中の補助金・助成金・融資${local.length}件を締切順に掲載。業種・目的別にも絞り込めます。`,
        rootRel,
        breadcrumbs: [["トップ", `${rootRel}index.html`], [region, null]],
        body,
      }),
    });
  }

  for (const ind of INDUSTRIES) {
    const items = inIndustry(ind.name);
    if (items.length === 0) continue;
    const rootRel = "../../";
    pages.push({
      relPath: `industry/${ind.slug}/index.html`,
      html: layout({
        title: `${ind.name}向けの補助金・助成金一覧（受付中）`,
        description: `${ind.name}を対象とする受付中の補助金・助成金・融資${items.length}件を締切順に掲載。`,
        rootRel,
        breadcrumbs: [["トップ", `${rootRel}index.html`], [ind.name, null]],
        body: `${updated}${itemList(items, rootRel)}
<p>このほか、業種を問わず使える案件が${anyIndustry.length}件あります。<a href="${rootRel}industry/${ANY_INDUSTRY_SLUG}/index.html">業種を問わない案件を見る</a></p>`,
      }),
    });
  }
  {
    const rootRel = "../../";
    pages.push({
      relPath: `industry/${ANY_INDUSTRY_SLUG}/index.html`,
      html: layout({
        title: "業種を問わず使える補助金・助成金一覧（受付中）",
        description: `業種の限定がない受付中の補助金・助成金・融資${anyIndustry.length}件を締切順に掲載。`,
        rootRel,
        breadcrumbs: [["トップ", `${rootRel}index.html`], ["業種を問わない", null]],
        body: `${updated}${itemList(anyIndustry, rootRel)}`,
      }),
    });
  }

  for (const pur of PURPOSES) {
    const items = inPurpose(pur.name);
    if (items.length === 0) continue;
    const rootRel = "../../";
    pages.push({
      relPath: `purpose/${pur.slug}/index.html`,
      html: layout({
        title: `「${pur.name}」に使える補助金・助成金一覧（受付中）`,
        description: `目的「${pur.name}」に該当する受付中の補助金・助成金・融資${items.length}件を締切順に掲載。`,
        rootRel,
        breadcrumbs: [["トップ", `${rootRel}index.html`], [pur.name, null]],
        body: `${updated}${itemList(items, rootRel)}`,
      }),
    });
  }

  // 業種×地域×目的のロングテールページ。該当0件の組み合わせは作らない(中身の無いページを量産しないため)
  let comboPages = 0;
  for (const region of [NATIONWIDE, ...PREFECTURES.map((p) => p.name)]) {
    const local = localOf(region);
    const slug = regionSlug.get(region)!;
    for (const pur of PURPOSES) {
      const items = local.filter((i) => i.purposes.includes(pur.name));
      if (items.length === 0) continue;
      const rootRel = "../../";
      pages.push({
        relPath: `region/${slug}/p-${pur.slug}.html`,
        html: layout({
          title: `${region}の「${pur.name}」補助金・助成金（受付中）`,
          description: `${region}で「${pur.name}」に使える受付中の補助金・助成金${items.length}件。締切順に掲載。`,
          rootRel,
          breadcrumbs: [["トップ", `${rootRel}index.html`], [region, `${rootRel}region/${slug}/index.html`], [pur.name, null]],
          body: `${updated}${itemList(items, rootRel)}`,
        }),
      });
      comboPages++;
    }
    for (const ind of INDUSTRIES) {
      for (const pur of PURPOSES) {
        const items = local.filter((i) => i.industries.includes(ind.name) && i.purposes.includes(pur.name));
        if (items.length === 0) continue;
        const rootRel = "../../../";
        const anyMatches = local.filter((i) => i.industries.length === 0 && i.purposes.includes(pur.name));
        const nationalMatches = region === NATIONWIDE
          ? []
          : nationwide.filter((i) => i.industries.includes(ind.name) && i.purposes.includes(pur.name));
        pages.push({
          relPath: `region/${slug}/${ind.slug}/${pur.slug}.html`,
          html: layout({
            title: `${region}の${ind.name}向け「${pur.name}」補助金・助成金（受付中）`,
            description: `${region}で${ind.name}が「${pur.name}」に使える受付中の補助金・助成金${items.length}件。締切順に掲載。`,
            rootRel,
            breadcrumbs: [
              ["トップ", `${rootRel}index.html`],
              [region, `${rootRel}region/${slug}/index.html`],
              [`${ind.name} × ${pur.name}`, null],
            ],
            body: `${updated}
<h2>${escapeHtml(region)}の${escapeHtml(ind.name)}向け案件（${items.length}件）</h2>${itemList(items, rootRel)}
${anyMatches.length > 0 ? `<h2>業種を問わず使える同条件の案件（${anyMatches.length}件）</h2>${itemList(anyMatches, rootRel)}` : ""}
${nationalMatches.length > 0 ? `<h2>全国対象で同じ条件の案件（${nationalMatches.length}件）</h2>${itemList(nationalMatches, rootRel)}` : ""}`,
          }),
        });
        comboPages++;
      }
    }
  }

  // 前回生成分に今回存在しないページが残らないよう、出力先(site/subsidy配下の生成物のみ)を作り直す
  await rm(OUT_DIR, { recursive: true, force: true });
  for (const page of pages) {
    const file = path.join(OUT_DIR, page.relPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page.html, "utf-8");
  }
  await writeFile(path.join(OUT_DIR, "style.css"), STYLE, "utf-8");
  console.log(`[generate] pages=${pages.length} combo=${comboPages} visibleItems=${visible.length} out=${OUT_DIR}`);
  return { pages: pages.length, visibleItems: visible.length, comboPages };
}
