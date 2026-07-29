import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { buildSystemPrompt, extractJsonBlock, extractText, runUntilComplete } from "./councilCore";
import { computeUsageCostUsd } from "./pricing";
import { appendExpense } from "../lib/ledger";
import type { LedgerEntry } from "../lib/ledger";
import { prisma } from "../lib/prisma";
import type { CandidateItem } from "./types";

const LEDGER_PATH = path.resolve(process.cwd(), "data", "ledger.json");

// lib/ledger.tsのreadAllEntries()は読み取り失敗(JSON破損等)を握りつぶして[]を返す設計
// (レポート系コマンドが初回実行で落ちないための仕様)。しかしサーキットブレーカーの判定に
// そのまま使うと「読めない=支出ゼロ」に誤読され、安全側に倒すつもりが逆に素通りしてしまう。
// このためファイル不存在(初回実行)だけを許容し、それ以外の読み取り失敗は例外として上位に
// 伝播させ、checkExploreBudget側でallowed=falseに倒す専用の読み取り関数を用意する
async function readLedgerStrict(): Promise<LedgerEntry[]> {
  let text: string;
  try {
    text = await readFile(LEDGER_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return JSON.parse(text) as LedgerEntry[];
}

// 1回あたりの費用は「設計目標」であり強制上限ではない(事後にしかコストが判明しないため)。
// 実効的な歯止めは月間・年間上限の事前チェック(オーナー承認、2026-07-29)
const DESIGN_TARGET_COST_JPY = 500;
const MONTHLY_CAP_JPY = 1000;
const YEARLY_CAP_JPY = 10000;
const MAX_EXPLORE_QUERIES = 5;

// BUDGET.mdの会計年度(2026-08〜2027-07)に合わせる。8月始まり
function getFiscalYearStart(now: Date): Date {
  const month = now.getUTCMonth(); // 0-11, 7=8月
  const year = month >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 7, 1));
}

function getMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  monthlySpentJpy: number;
  yearlySpentJpy: number;
}

// ledger読み取りに失敗した場合・費目集計中に例外が起きた場合は必ず安全側(allowed=false)に倒す
export async function checkExploreBudget(): Promise<BudgetCheckResult> {
  let entries;
  try {
    entries = await readLedgerStrict();
  } catch (err) {
    return {
      allowed: false,
      reason: `ledger読み取りに失敗したため安全側でスキップ: ${err instanceof Error ? err.message : String(err)}`,
      monthlySpentJpy: 0,
      yearlySpentJpy: 0,
    };
  }

  const now = new Date();
  const monthStart = getMonthStart(now);
  const yearStart = getFiscalYearStart(now);

  const exploreEntries = entries.filter((e) => e.category === "api" && e.service === "council-explore" && e.amountJpy !== null);

  const monthlySpentJpy = exploreEntries
    .filter((e) => new Date(e.recordedAt) >= monthStart)
    .reduce((sum, e) => sum + (e.amountJpy ?? 0), 0);
  const yearlySpentJpy = exploreEntries
    .filter((e) => new Date(e.recordedAt) >= yearStart)
    .reduce((sum, e) => sum + (e.amountJpy ?? 0), 0);

  if (monthlySpentJpy >= MONTHLY_CAP_JPY) {
    return {
      allowed: false,
      reason: `月間上限(${MONTHLY_CAP_JPY}円)に到達済み(当月実績${monthlySpentJpy}円)`,
      monthlySpentJpy,
      yearlySpentJpy,
    };
  }
  if (yearlySpentJpy >= YEARLY_CAP_JPY) {
    return {
      allowed: false,
      reason: `年間上限(${YEARLY_CAP_JPY}円)に到達済み(当年度実績${yearlySpentJpy}円)`,
      monthlySpentJpy,
      yearlySpentJpy,
    };
  }
  return { allowed: true, monthlySpentJpy, yearlySpentJpy };
}

async function buildExploreSystemPrompt(existingSourcesSummary: string): Promise<string> {
  const governance = await buildSystemPrompt();
  return `${governance}

--- 自律探索フェーズ専用の追加指示 ---
あなたは今、テーマH(ビジネスヒントのメタ・ハーヴェスト)の"タネ集め"段階における
自律探索フェーズを担当しています。これは固定登録された巡回対象(sources)とは別に、
あなた自身がその場で検索クエリを考え、web_searchで実際に検索して新しい候補を発見する役割です。

絶対厳守(RULES.mdより、この探索フェーズでは特に重要):
1. 自分の営業アセット(生保・esportsセールス経験)を検索クエリの着想・評価根拠に使わない
2. 既存プロジェクト(下記の既存sources・既存テーマ)への引きずられを避ける。
   既に登録されている分野をなぞるのではなく、その補集合(まだ拾えていない業界・地域・
   属性)を優先的に検索すること

--- 現在アクティブな固定sources(companyName / テーマID)の一覧 ---
${existingSourcesSummary}
--- 一覧ここまで ---

タスク:
1. 上記の一覧を踏まえ、まだ拾えていない業界・地域・属性を狙った検索クエリを3〜5個考える
2. それぞれのクエリでweb_searchを実際に実行する
3. 発見した項目のうち、ビジネスヒントとして深掘りに値する可能性があるものを抽出する
4. 最後に、以下の形式のfenced codeブロック(\`\`\`json)で結果を出力する。このJSONのみが
   機械的にパースされるので、必ず有効なJSONにすること

\`\`\`json
{
  "items": [
    {
      "title": "発見した項目のタイトル",
      "url": "出典URL",
      "query": "この項目を発見した検索クエリ",
      "publishedAt": "ISO日付文字列(不明なら省略可)"
    }
  ]
}
\`\`\`

発見物がゼロでも構わない。無理に埋めず、本当に有望なものだけを残すこと。`;
}

interface ExploreJson {
  items: Array<{ title: string; url: string; query: string; publishedAt?: string }>;
}

function isExploreJson(parsed: unknown): parsed is ExploreJson {
  const p = parsed as Partial<ExploreJson> | null;
  if (!p || !Array.isArray(p.items)) return false;
  return p.items.every((i) => !!i.title && !!i.url && !!i.query);
}

function parseExploreJson(text: string): ExploreJson | null {
  return extractJsonBlock(text, isExploreJson);
}

async function buildExistingSourcesSummary(): Promise<string> {
  const sources = await prisma.source.findMany({
    where: { active: true },
    select: { companyName: true, insuranceType: true },
  });
  const byTheme = new Map<string, string[]>();
  for (const s of sources) {
    const list = byTheme.get(s.insuranceType) ?? [];
    list.push(s.companyName);
    byTheme.set(s.insuranceType, list);
  }
  const lines: string[] = [];
  for (const [theme, names] of [...byTheme.entries()].sort()) {
    lines.push(`- ${theme}(${names.length}件): ${names.join("、")}`);
  }
  return lines.join("\n") || "(登録済みsourcesなし)";
}

// 選定評議会の直前に実行する自律探索フェーズ。失敗しても既存パイプライン(固定フィード収集
// →選定評議会→判断評議会)は必ず継続させるため、例外は握りつぶさずログに残した上で空配列を返す
export async function runExplorePhase(): Promise<CandidateItem[]> {
  try {
    const budgetCheck = await checkExploreBudget();
    if (!budgetCheck.allowed) {
      console.log(`[council/explore] 自律探索フェーズをスキップします: ${budgetCheck.reason}`);
      return [];
    }
    console.log(
      `[council/explore] 予算チェックOK(当月実績${budgetCheck.monthlySpentJpy}円/上限${MONTHLY_CAP_JPY}円、` +
        `当年度実績${budgetCheck.yearlySpentJpy}円/上限${YEARLY_CAP_JPY}円)。探索フェーズを実行します`,
    );

    const existingSourcesSummary = await buildExistingSourcesSummary();
    const client = new Anthropic();
    const systemPrompt = await buildExploreSystemPrompt(existingSourcesSummary);
    const messages: MessageParam[] = [
      {
        role: "user",
        content: `自律探索フェーズを開始してください。最大${MAX_EXPLORE_QUERIES}クエリで、まだ拾えていない` +
          `業界・地域を狙って実際にweb_searchしてください。`,
      },
    ];

    const result = await runUntilComplete(client, systemPrompt, messages);
    const text = extractText(result.message.content);
    const parsed = parseExploreJson(text);

    const estimatedCostUsd = computeUsageCostUsd(result.usage);
    let estimatedCostJpy: number | null = null;
    try {
      const entry = await appendExpense({
        category: "api",
        service: "council-explore",
        amountUsd: estimatedCostUsd,
        amountJpy: null,
        description: `自律探索フェーズ: 発見${parsed?.items.length ?? 0}件(検索${result.usage.webSearchRequests}回)`,
        occurredAt: new Date().toISOString(),
      });
      estimatedCostJpy = entry.amountJpy;
    } catch (err) {
      console.error(
        `[council/explore] ledger記帳に失敗しました(探索自体は続行、要手動確認): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (estimatedCostJpy !== null && estimatedCostJpy > DESIGN_TARGET_COST_JPY) {
      console.warn(
        `[council/explore] 設計目標(${DESIGN_TARGET_COST_JPY}円)を超過しました(約${estimatedCostJpy}円)。` +
          `月間・年間上限の事前チェックで次回以降は歯止めがかかります`,
      );
    }

    if (!parsed) {
      console.warn("[council/explore] 探索結果のJSONパースに失敗したため、今回は候補ゼロとして扱います");
      return [];
    }

    console.log(`[council/explore] 探索完了: ${parsed.items.length}件発見(見積コスト約${estimatedCostJpy ?? "不明"}円)`);

    return parsed.items.map((item) => ({
      title: item.title,
      url: item.url,
      sourceCompanyName: `自律探索: "${item.query}"`,
      publishedAt: item.publishedAt,
      origin: "explore" as const,
    }));
  } catch (err) {
    console.error(
      `[council/explore] 自律探索フェーズが失敗しました(既存パイプラインは続行します): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return [];
  }
}
