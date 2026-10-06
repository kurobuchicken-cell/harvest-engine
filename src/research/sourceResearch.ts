import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import robotsParser from "robots-parser";
import { extractJsonBlock, extractText } from "../council/councilCore";
import { WEB_SEARCH_COST_PER_SEARCH_USD } from "../council/pricing";
import { decodeHtml, fetchWithTimeout, htmlToText, isPdf } from "../factory/fetch";
import { ROBOTS_TIMEOUT_MS, USER_AGENT } from "../lib/constants";

const SEARCH_MODEL = "claude-sonnet-5-5";
// Haiku 4.5では規約の例外条項の適用範囲を読み分けられず(PDL1.0の「一部コンテンツは届出」を全体の商用禁止と判定)、
// 同じ規約でも判定が揺れたため、法務ゲートの入口としてSonnetを使う(2026-10-06比較)
const TOS_MODEL = "claude-sonnet-5-5";
const PRICES_PER_M_USD: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
};
// 1回の調査の検索回数上限。20回では国内の裏取りで使い切り海外が未調査になった(2026-10-06リコールで実測)。
// 30回で暴走時の検索費は約45円
const MAX_WEB_SEARCHES = 30;
// 規約ページは数千〜2万字程度。極端に長いページで費用が膨らまないよう先頭のみ渡し、出力に明記する
const TOS_MAX_CHARS = 30_000;

// CLAUDE.md「巡回対象選定の追加ルール」: これらを名指しでDisallowしているサイトは原則active化しない
const AI_BOTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "CCBot",
  "Google-Extended", "PerplexityBot", "Bytespider", "Applebot-Extended", "meta-externalagent",
];

export interface ResearchInput {
  topic: string;
  context: string;
}

export interface SourceCandidate {
  name: string;
  organization: string;
  sourceType: "maker" | "government" | "association" | "other";
  listUrl: string;
  format: "html" | "rss" | "api" | "pdf";
  feedUrl: string | null;
  updateFrequency: string;
  kind: "catalog" | "announcement" | "api" | "none";
  termsUrl: string | null;
  coverage: string;
  evidence: string;
}

interface CandidateList {
  candidates: SourceCandidate[];
  notes: string;
}

export interface RobotsCheck {
  status: "allowed" | "disallowed" | "no_robots" | "indeterminate";
  httpStatus: number | null;
  blockedAiBots: string[];
}

export interface PageCheck {
  httpStatus: number | null;
  error: string | null;
  textLength: number;
  linkCount: number;
  isPdf: boolean;
  spaSuspected: boolean;
  discoveredFeeds: string[];
  discoveredTermsUrl: string | null;
  feedOk: boolean | null;
}

export interface TosCheck {
  fetched: boolean;
  truncated: boolean;
  scraping: string;
  reuse: string;
  commercial: string;
  quote: string | null;
  summary: string;
}

export type Recommendation = "登録候補" | "要確認" | "不可";

export interface CheckedCandidate {
  candidate: SourceCandidate;
  robots: RobotsCheck;
  page: PageCheck;
  tos: TosCheck | null;
  recommendation: Recommendation;
  reasons: string[];
}

export interface ResearchResult {
  topic: string;
  generatedAt: string;
  notes: string;
  checked: CheckedCandidate[];
  usage: { searchInputTokens: number; searchOutputTokens: number; webSearches: number; tosInputTokens: number; tosOutputTokens: number };
  costUsd: number;
}

const SYSTEM_PROMPT = `あなたはharvest-engineの調査部です。harvest-engineは「出口工場」型の事業で、一次情報源
(メーカー公式の新商品ページ・官公庁の発表等)を自動収集し、AIで構造化して日本語・多言語のページを自動生成し、
アフィリエイト・広告で小さく稼ぐ。評議会が採択したジャンルについて、自動巡回の対象にできる一次情報源の候補を
web_searchで実際に探して一覧にするのがあなたの役割です。

条件:
- 一次情報源に限る(メーカー・発売元の公式サイト、官公庁、業界団体)。ニュースサイト・まとめサイト・
  他社のデータベース等の二次情報は候補に入れない
- 「新しい情報が定期的に追加される一覧ページ」のURLを挙げる(トップページではなく、新商品一覧・お知らせ一覧・
  リコール一覧等)。RSS・公開APIがあれば優先し、そのURLも挙げる
- URLは検索結果で実在を確認したものだけを書く。推測でURLを組み立てない
- 利用規約・サイトポリシーのページが見つかればtermsUrlに書く(見つからなければnull)
- kindは出口工場の収集の型: catalog=メーカーの新作・新商品一覧、announcement=各社のお知らせから特定の告知を拾う、
  api=公開APIの一覧+詳細、none=いずれにも合わない
- 候補は重要度の高い順に最大12件。同じ組織の別ページは1件にまとめる

最後に、次の形式のJSONを\`\`\`jsonブロックで1つだけ出力してください。
{"candidates":[{"name":"情報源名","organization":"運営組織","sourceType":"maker|government|association|other",
"listUrl":"一覧ページURL","format":"html|rss|api|pdf","feedUrl":"RSS/APIのURLまたはnull","updateFrequency":"更新頻度の目安",
"kind":"catalog|announcement|api|none","termsUrl":"規約ページURLまたはnull","coverage":"何が載っているか(1文)",
"evidence":"一次情報源と判断した根拠(1文)"}],"notes":"ジャンル全体の所見(一次情報源の厚み・空白地帯など、2〜3文)"}`;

function isCandidateList(v: unknown): v is CandidateList {
  if (!v || typeof v !== "object") return false;
  const list = (v as { candidates?: unknown }).candidates;
  return Array.isArray(list) && list.every((c) => c && typeof c === "object" && typeof (c as SourceCandidate).listUrl === "string");
}

async function listCandidates(client: Anthropic, input: ResearchInput) {
  let messages: MessageParam[] = [
    {
      role: "user",
      content: `ジャンル: ${input.topic}\n\n評議会での審議内容(参考):\n${input.context || "(なし)"}\n\nこのジャンルの一次情報源の候補を調べてください。`,
    },
  ];
  const usage = { input: 0, output: 0, searches: 0 };
  let message: Anthropic.Message;
  // web_searchはサーバー側の反復が上限に達するとpause_turnで返るため、同じmessagesで再送して続きを実行させる
  for (;;) {
    message = await client.messages
      .stream({
        model: SEARCH_MODEL,
        max_tokens: 32000,
        system: SYSTEM_PROMPT,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_WEB_SEARCHES }],
        messages,
      })
      .finalMessage();
    usage.input += message.usage.input_tokens;
    usage.output += message.usage.output_tokens;
    usage.searches += message.usage.server_tool_use?.web_search_requests ?? 0;
    if (message.stop_reason !== "pause_turn") break;
    messages = [...messages, { role: "assistant", content: message.content }];
  }

  if (message.stop_reason === "refusal") throw new Error("候補の列挙がモデルに拒否されました");
  const parsed = extractJsonBlock(extractText(message.content), isCandidateList);
  if (!parsed) throw new Error(`候補一覧のJSONを読み取れませんでした(stop_reason=${message.stop_reason})`);
  return { list: parsed, usage };
}

async function checkRobots(listUrl: string): Promise<RobotsCheck> {
  const robotsUrl = `${new URL(listUrl).origin}/robots.txt`;
  let httpStatus: number | null = null;
  let body = "";
  try {
    const res = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS) });
    httpStatus = res.status;
    body = res.ok ? await res.text() : "";
  } catch {
    return { status: "indeterminate", httpStatus: null, blockedAiBots: [] };
  }
  if (httpStatus === 404 || httpStatus === 410) return { status: "no_robots", httpStatus, blockedAiBots: [] };
  // 403/418/5xx等はWAFによるブロックの可能性があり、制限なしとは断定できない(India RBIの418の例)
  if (httpStatus !== 200) return { status: "indeterminate", httpStatus, blockedAiBots: [] };

  const robots = robotsParser(robotsUrl, body);
  const namedAgents = [...body.matchAll(/^\s*user-agent\s*:\s*(\S+)/gim)].map((m) => m[1].toLowerCase());
  const blockedAiBots = AI_BOTS.filter(
    (bot) => namedAgents.includes(bot.toLowerCase()) && robots.isAllowed(listUrl, bot) === false,
  );
  const allowed = robots.isAllowed(listUrl, USER_AGENT) ?? true;
  return { status: allowed ? "allowed" : "disallowed", httpStatus, blockedAiBots };
}

function findFeedLinks(html: string, baseUrl: string): string[] {
  const feeds = new Set<string>();
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/type=["']application\/(rss|atom)\+xml["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      feeds.add(new URL(href, baseUrl).toString());
    } catch {
      continue;
    }
  }
  return [...feeds];
}

// AIに検索させると検索回数を情報源探しで使い切り規約まで届かないため、一覧ページのフッター等のリンクから拾う
const TERMS_LINK_TEXT = /利用規約|サイトポリシー|サイトのご利用|ご利用にあたって|ご利用について|このサイトについて|著作権|免責|terms|legal notice|copyright/i;

function findTermsLink(html: string, baseUrl: string): string | null {
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (!text || text.length > 40 || !TERMS_LINK_TEXT.test(text)) continue;
    try {
      return new URL(m[1], baseUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

async function isFeedReachable(url: string): Promise<boolean> {
  const res = await fetchWithTimeout(url);
  if (res.status !== 200 || !res.body) return false;
  const text = res.body.subarray(0, 4096).toString("utf-8").trimStart();
  return /<(rss|feed|rdf:RDF)\b/i.test(text) || text.startsWith("{") || text.startsWith("[");
}

async function checkPage(candidate: SourceCandidate): Promise<PageCheck> {
  const res = await fetchWithTimeout(candidate.listUrl);
  const base: PageCheck = {
    httpStatus: res.status, error: res.error ?? null, textLength: 0, linkCount: 0,
    isPdf: false, spaSuspected: false, discoveredFeeds: [], discoveredTermsUrl: null, feedOk: null,
  };
  if (res.body) {
    if (isPdf(res.body)) {
      base.isPdf = true;
    } else {
      const html = decodeHtml(res.body);
      base.textLength = htmlToText(html).length;
      base.linkCount = (html.match(/<a\s[^>]*href=/gi) ?? []).length;
      // 本文がJSで描画されるサイトは取得したHTMLに一覧が含まれず、現行の巡回方式では拾えない(EU Safety Gateの例)
      base.spaSuspected = base.textLength < 300 || (base.linkCount < 10 && /id=["'](root|app|__next|__nuxt)["']/i.test(html));
      base.discoveredFeeds = findFeedLinks(html, candidate.listUrl);
      base.discoveredTermsUrl = findTermsLink(html, candidate.listUrl);
    }
  }
  const feedUrl = candidate.feedUrl ?? base.discoveredFeeds[0] ?? null;
  if (feedUrl) base.feedOk = await isFeedReachable(feedUrl);
  return base;
}

function isTosCheck(v: unknown): v is Omit<TosCheck, "fetched" | "truncated"> {
  return !!v && typeof v === "object" && typeof (v as TosCheck).scraping === "string" && typeof (v as TosCheck).summary === "string";
}

async function checkTos(client: Anthropic, termsUrl: string, usage: { input: number; output: number }): Promise<TosCheck> {
  const unknown: TosCheck = { fetched: false, truncated: false, scraping: "不明", reuse: "不明", commercial: "不明", quote: null, summary: "規約ページを取得できませんでした" };
  const res = await fetchWithTimeout(termsUrl);
  if (res.status !== 200 || !res.body || isPdf(res.body)) return unknown;
  const fullText = htmlToText(decodeHtml(res.body));
  const truncated = fullText.length > TOS_MAX_CHARS;
  const response = await client.messages.create({
    model: TOS_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `次はあるWebサイトの利用規約・サイトポリシーの本文です。プログラムによる自動取得(クローリング・スクレイピング)と、
掲載情報の再利用について、次の形式のJSONを\`\`\`jsonブロックで出力してください。値は「禁止」「条件付き」「記載なし」「不明」のいずれか。
本文に該当する記述が無い場合は「記載なし」、本文が規約になっていない・読み取れない場合は「不明」とし、
「禁止」は禁止する条文がある場合に限ってquoteにその条文を抜粋すること。
scrapingを「禁止」とするのは、クローラ・ロボット・スクレイピング・機械的な収集等の自動取得を明示的に禁じる条文がある
場合だけとする。著作権法上の一般的な注意書き(無断転載・複製の禁止等)はscrapingではなくreuseで扱う。
営利目的・商用での利用に事前の許可や申請が必要な場合、commercialは「禁止」とする。ただし許可や申請が
一部の種類のコンテンツ(第三者提供のコンテンツ等)に限られる例外条項なら、全体としては「条件付き」とし、
例外の範囲をsummaryに書くこと。
{"scraping":"自動取得の扱い","reuse":"掲載情報の転載・再利用の扱い","commercial":"商用利用の扱い",
"quote":"根拠となる条文の本文からの抜粋(要約や意見ではなく原文。該当なしならnull)","summary":"判断の要約(1文)"}

--- 本文 ---
${fullText.slice(0, TOS_MAX_CHARS)}`,
      },
    ],
  });
  usage.input += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;
  const parsed = extractJsonBlock(extractText(response.content), isTosCheck);
  if (!parsed) return { ...unknown, fetched: true, summary: "規約の要約を読み取れませんでした" };
  // 根拠の条文なしに「禁止」と答える誤判定があり(2026-10-06消費者庁リコール情報サイトで実測)、
  // 「不可」は良い情報源を落とすため、抜粋の無い禁止は確認待ちに倒す
  if (!parsed.quote) {
    if (parsed.scraping === "禁止") parsed.scraping = "不明";
    if (parsed.reuse === "禁止") parsed.reuse = "不明";
  }
  return { ...parsed, fetched: true, truncated };
}

function recommend(robots: RobotsCheck, page: PageCheck, tos: TosCheck | null): { recommendation: Recommendation; reasons: string[] } {
  const ng: string[] = [];
  const check: string[] = [];
  if (robots.status === "disallowed") ng.push("robots.txtで自ボットの取得が禁止");
  if (robots.blockedAiBots.length) ng.push(`robots.txtでAIボットを名指しで拒否(${robots.blockedAiBots.join(", ")})`);
  if (robots.status === "indeterminate") check.push(`robots.txtが判定不能(HTTP ${robots.httpStatus ?? "接続失敗"})`);
  if (tos?.scraping === "禁止") ng.push("規約で自動取得が禁止");
  if (page.httpStatus !== 200) check.push(`一覧ページを取得できない(${page.httpStatus ?? page.error})`);
  else if (page.spaSuspected) check.push("一覧がJSで描画されている疑い(取得HTMLに中身が少ない)");
  if (page.feedOk === false) check.push("RSS/APIのURLが応答しない");
  if (!tos) check.push("規約ページ未特定");
  else if (!tos.fetched) check.push("規約ページを取得できない");
  else if (tos.scraping === "不明") check.push("規約の要約に失敗");
  if (tos?.reuse === "禁止") check.push("規約で転載が禁止(自前の要約+リンクの形なら可か要確認)");
  if (tos?.commercial === "禁止") check.push("規約で商用利用が禁止または要許可(出口工場は広告・アフィリエイトで稼ぐため)");
  if (tos?.truncated) check.push(`規約が長く先頭${TOS_MAX_CHARS}字のみ確認`);

  if (ng.length) return { recommendation: "不可", reasons: [...ng, ...check] };
  if (check.length) return { recommendation: "要確認", reasons: check };
  return { recommendation: "登録候補", reasons: [] };
}

export async function checkCandidate(
  client: Anthropic,
  candidate: SourceCandidate,
  tosUsage: { input: number; output: number },
): Promise<CheckedCandidate> {
  const robots = await checkRobots(candidate.listUrl);
  const page = await checkPage(candidate);
  // 府省のサブサイトは親組織の規約とは別に独自の規約を持つことがあり(消費者庁リコール情報サイトは営利目的の利用が
  // 事前許可制)、AIは親組織の規約を挙げがちなため、一覧ページと同じホストの規約リンクを優先する
  const discovered = page.discoveredTermsUrl;
  const sameHost = discovered !== null && new URL(discovered).host === new URL(candidate.listUrl).host;
  const termsUrl = sameHost ? discovered : (candidate.termsUrl ?? discovered);
  const tos = termsUrl ? await checkTos(client, termsUrl, tosUsage) : null;
  const { recommendation, reasons } = recommend(robots, page, tos);
  console.log(`[research] ${recommendation} ${candidate.name} robots=${robots.status} http=${page.httpStatus} tos=${tos?.scraping ?? "-"}`);
  return { candidate: { ...candidate, termsUrl }, robots, page, tos, recommendation, reasons };
}

export async function researchSources(input: ResearchInput): Promise<ResearchResult> {
  const client = new Anthropic();
  const { list, usage: searchUsage } = await listCandidates(client, input);
  console.log(`[research] candidates=${list.candidates.length} webSearches=${searchUsage.searches}`);

  const tosUsage = { input: 0, output: 0 };
  const checked: CheckedCandidate[] = [];
  for (const candidate of list.candidates) {
    checked.push(await checkCandidate(client, candidate, tosUsage));
  }

  const s = PRICES_PER_M_USD[SEARCH_MODEL];
  const t = PRICES_PER_M_USD[TOS_MODEL];
  const costUsd =
    (searchUsage.input * s.input + searchUsage.output * s.output) / 1_000_000 +
    searchUsage.searches * WEB_SEARCH_COST_PER_SEARCH_USD +
    (tosUsage.input * t.input + tosUsage.output * t.output) / 1_000_000;

  return {
    topic: input.topic,
    generatedAt: new Date().toISOString(),
    notes: list.notes,
    checked,
    usage: {
      searchInputTokens: searchUsage.input, searchOutputTokens: searchUsage.output, webSearches: searchUsage.searches,
      tosInputTokens: tosUsage.input, tosOutputTokens: tosUsage.output,
    },
    costUsd,
  };
}

// 判定ロジックの修正時や時間をおいた再確認用。AIの候補列挙(検索費の大半)はやり直さず、保存済みの候補をチェックし直す
export async function recheckSources(previous: ResearchResult): Promise<ResearchResult> {
  const client = new Anthropic();
  const tosUsage = { input: 0, output: 0 };
  const checked: CheckedCandidate[] = [];
  for (const r of previous.checked) {
    checked.push(await checkCandidate(client, r.candidate, tosUsage));
  }
  const t = PRICES_PER_M_USD[TOS_MODEL];
  return {
    ...previous,
    generatedAt: new Date().toISOString(),
    checked,
    usage: { searchInputTokens: 0, searchOutputTokens: 0, webSearches: 0, tosInputTokens: tosUsage.input, tosOutputTokens: tosUsage.output },
    costUsd: (tosUsage.input * t.input + tosUsage.output * t.output) / 1_000_000,
  };
}

const ORDER: Recommendation[] = ["登録候補", "要確認", "不可"];

export function toMarkdown(result: ResearchResult, costJpy: number | null): string {
  const rows = [...result.checked].sort((a, b) => ORDER.indexOf(a.recommendation) - ORDER.indexOf(b.recommendation));
  const cell = (s: string) => s.replace(/\|/g, "／").replace(/\n/g, " ");
  const lines = [
    `# 一次情報源調査: ${result.topic}`,
    "",
    `- 実行: ${result.generatedAt}`,
    `- 費用: ${costJpy !== null ? `${costJpy}円` : `$${result.costUsd.toFixed(3)}`}(検索${result.usage.webSearches}回)`,
    `- 判定はGMの最終確認前の一次判定。規約の要約はAIによるもので、登録前に原文を確認すること`,
    "",
    `## 所見`,
    "",
    result.notes,
    "",
    `## 候補一覧`,
    "",
    "| 判定 | 情報源 | 型 | 形式 | 更新頻度 | robots.txt | 取得 | 規約(自動取得/転載/商用) | 理由 |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const c = r.candidate;
    const robots = r.robots.status + (r.robots.blockedAiBots.length ? `(AI拒否: ${r.robots.blockedAiBots.join(",")})` : "");
    const page = r.page.httpStatus === 200 ? (r.page.isPdf ? "PDF" : r.page.spaSuspected ? "JS描画疑い" : `OK(リンク${r.page.linkCount})`) : `NG(${r.page.httpStatus ?? r.page.error})`;
    const tos = r.tos ? `${r.tos.scraping}/${r.tos.reuse}/${r.tos.commercial}` : "未特定";
    lines.push(
      `| ${r.recommendation} | [${cell(c.name)}](${c.listUrl}) | ${c.kind} | ${c.format}${c.feedUrl || r.page.discoveredFeeds.length ? "+feed" : ""} | ${cell(c.updateFrequency)} | ${robots} | ${page} | ${tos} | ${cell(r.reasons.join("; ") || "-")} |`,
    );
  }
  lines.push("", "## 候補の詳細", "");
  for (const r of rows) {
    const c = r.candidate;
    lines.push(
      `### ${c.name}(${c.organization})`,
      "",
      `- 判定: ${r.recommendation}${r.reasons.length ? ` — ${r.reasons.join("; ")}` : ""}`,
      `- 一覧: ${c.listUrl}`,
      `- フィード/API: ${c.feedUrl ?? (r.page.discoveredFeeds.join(", ") || "なし")}${r.page.feedOk === null ? "" : r.page.feedOk ? "(応答あり)" : "(応答なし)"}`,
      `- 内容: ${c.coverage}`,
      `- 一次情報源の根拠: ${c.evidence}`,
      `- 規約: ${c.termsUrl ? `${c.termsUrl}${c.termsUrl === r.page.discoveredTermsUrl ? "(一覧ページのリンクから自動検出)" : ""}` : "未特定"}${r.tos ? ` — ${r.tos.summary}${r.tos.quote ? `「${r.tos.quote}」` : ""}` : ""}`,
      "",
    );
  }
  return lines.join("\n");
}
