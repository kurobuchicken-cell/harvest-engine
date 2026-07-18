import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const LEDGER_PATH = path.resolve(process.cwd(), "data", "ledger.json");

// 為替情報源(open.er-api.com、認証不要・無料)。ハードコードした固定レートは使わない。
// 過去に1ドル169円という古いレートで誤記帳した事故があったための方針(BUDGET.md参照)
const FX_RATE_URL = "https://open.er-api.com/v6/latest/USD";

export type ExpenseCategory = "api" | "domain" | "ads" | "legal" | "misc";

export interface ExpenseInput {
  category: ExpenseCategory;
  service: string;
  amountUsd: number | null;
  amountJpy: number | null;
  description: string;
  occurredAt: string; // ISO日付
}

export type FxRateStatus = "resolved" | "unresolved" | "not_applicable";

export interface LedgerEntry extends ExpenseInput {
  id: string;
  fxRate: number | null;
  fxRateFetchedAt: string | null;
  fxRateSource: string | null;
  fxRateStatus: FxRateStatus;
  recordedAt: string; // ISO日時、ledgerへ追記した実時刻
}

interface FxRateResult {
  rate: number | null;
  fetchedAt: string;
  source: string;
}

async function fetchUsdJpyRate(): Promise<FxRateResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(FX_RATE_URL);
    if (!res.ok) {
      return { rate: null, fetchedAt, source: FX_RATE_URL };
    }
    const body = (await res.json()) as { rates?: Record<string, number> };
    const rate = body.rates?.JPY;
    return { rate: typeof rate === "number" ? rate : null, fetchedAt, source: FX_RATE_URL };
  } catch {
    return { rate: null, fetchedAt, source: FX_RATE_URL };
  }
}

async function readLedger(): Promise<LedgerEntry[]> {
  try {
    const text = await readFile(LEDGER_PATH, "utf-8");
    return JSON.parse(text) as LedgerEntry[];
  } catch {
    return [];
  }
}

async function writeLedger(entries: LedgerEntry[]): Promise<void> {
  await mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await writeFile(LEDGER_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");
}

// 台帳は追記専用。既存エントリの上書き・削除は行わない(呼び出し元に該当APIも提供しない)。
// amountUsdが指定されている場合、記帳のたびに為替レートを外部APIから取得して記録する。
// amountJpyが未指定ならこのレートで自動換算し、指定済みなら値はそのまま尊重した上で
// (参考情報として)取得できたレートだけを併記する。レート取得に失敗した場合は
// amountJpyをnullのままにせず、指定値があればそれを残し、無ければnullのままfxRateStatus='unresolved'とする
export async function appendExpense(input: ExpenseInput): Promise<LedgerEntry> {
  let fxRate: number | null = null;
  let fxRateFetchedAt: string | null = null;
  let fxRateSource: string | null = null;
  let fxRateStatus: FxRateStatus;
  let amountJpy = input.amountJpy;

  if (input.amountUsd === null) {
    fxRateStatus = "not_applicable";
  } else {
    const fx = await fetchUsdJpyRate();
    fxRateFetchedAt = fx.fetchedAt;
    fxRateSource = fx.source;
    fxRate = fx.rate;

    if (fx.rate === null) {
      fxRateStatus = "unresolved";
      // 推測値で埋めない。amountJpyが未指定のままならnullで確定させ、要手動確認として残す
    } else {
      fxRateStatus = "resolved";
      if (amountJpy === null) {
        amountJpy = Math.round(input.amountUsd * fx.rate);
      }
    }
  }

  const entry: LedgerEntry = {
    ...input,
    amountJpy,
    id: randomUUID(),
    fxRate,
    fxRateFetchedAt,
    fxRateSource,
    fxRateStatus,
    recordedAt: new Date().toISOString(),
  };

  const existing = await readLedger();
  existing.push(entry);
  await writeLedger(existing);

  return entry;
}

export async function readAllEntries(): Promise<LedgerEntry[]> {
  return readLedger();
}
