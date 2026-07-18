import { readAllEntries, type ExpenseCategory, type LedgerEntry } from "./lib/ledger";

// BUDGET.mdの費目別配分(年間予算200,000円)。ledgerのcategoryと1:1で対応させている
const CATEGORY_BUDGETS: Record<ExpenseCategory, { label: string; budgetJpy: number }> = {
  ads: { label: "需要テスト", budgetJpy: 80_000 },
  api: { label: "API", budgetJpy: 48_000 },
  legal: { label: "法務", budgetJpy: 40_000 },
  domain: { label: "ドメイン・雑費", budgetJpy: 12_000 },
  misc: { label: "予備", budgetJpy: 20_000 },
};
const TOTAL_BUDGET_JPY = 200_000;
const WARNING_RATIO = 0.2; // 費目残額が予算の20%を切ったら警報(BUDGET.md経理ルール)

export interface CategorySummary {
  category: ExpenseCategory;
  label: string;
  budgetJpy: number;
  spentJpy: number;
  remainingJpy: number;
  consumptionRate: number;
  belowWarningLine: boolean;
}

export interface LedgerReport {
  categories: CategorySummary[];
  totalBudgetJpy: number;
  totalSpentJpy: number;
  totalConsumptionRate: number;
  unresolvedEntries: LedgerEntry[];
}

export async function buildLedgerReport(): Promise<LedgerReport> {
  const entries = await readAllEntries();

  const categories: CategorySummary[] = (Object.keys(CATEGORY_BUDGETS) as ExpenseCategory[]).map((category) => {
    const { label, budgetJpy } = CATEGORY_BUDGETS[category];
    const spentJpy = entries
      .filter((e) => e.category === category && e.amountJpy !== null)
      .reduce((sum, e) => sum + (e.amountJpy ?? 0), 0);
    const remainingJpy = budgetJpy - spentJpy;
    const consumptionRate = budgetJpy > 0 ? spentJpy / budgetJpy : 0;

    return {
      category,
      label,
      budgetJpy,
      spentJpy,
      remainingJpy,
      consumptionRate,
      belowWarningLine: remainingJpy < budgetJpy * WARNING_RATIO,
    };
  });

  const totalSpentJpy = categories.reduce((sum, c) => sum + c.spentJpy, 0);
  const unresolvedEntries = entries.filter((e) => e.fxRateStatus === "unresolved");

  return {
    categories,
    totalBudgetJpy: TOTAL_BUDGET_JPY,
    totalSpentJpy,
    totalConsumptionRate: totalSpentJpy / TOTAL_BUDGET_JPY,
    unresolvedEntries,
  };
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const report = await buildLedgerReport();

  console.log("=== 支出台帳サマリ (data/ledger.json) ===");
  console.log(`年間予算合計: ${report.totalBudgetJpy.toLocaleString()}円`);
  console.log(
    `累計支出(円建て確定分のみ): ${report.totalSpentJpy.toLocaleString()}円 (消化率 ${formatPercent(report.totalConsumptionRate)})`,
  );
  console.log("");
  console.log("--- 費目別 ---");
  for (const c of report.categories) {
    const warn = c.belowWarningLine ? " ⚠️残額20%未満" : "";
    console.log(
      `${c.label}: 支出${c.spentJpy.toLocaleString()}円 / 予算${c.budgetJpy.toLocaleString()}円 / 残額${c.remainingJpy.toLocaleString()}円 (消化率${formatPercent(c.consumptionRate)})${warn}`,
    );
  }

  if (report.unresolvedEntries.length > 0) {
    console.log("");
    console.log(`--- ⚠️ 為替レート未解決(要手動確認): ${report.unresolvedEntries.length}件 ---`);
    for (const e of report.unresolvedEntries) {
      console.log(
        `  - [${e.occurredAt}] ${e.service} $${e.amountUsd ?? "?"} "${e.description}" (id=${e.id})`,
      );
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
