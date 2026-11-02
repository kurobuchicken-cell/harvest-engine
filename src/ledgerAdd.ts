// コードの外で払うもの(広告・会員費など)を台帳に記帳する。API はコードが自動で記帳するが、画面で払うものは記帳の道が無く漏れたため(2026-11-02、Instagram の宣伝が未記帳だった)
// 使い方: npm run ledger:add -- <ads|domain|legal|misc|api> <サービス名> <金額 例 21usd / 3000jpy> "<内容>" [YYYY-MM-DD]
//   出稿・申し込みの時点で上限額(予定)を記帳し、確定額との差は確定した日に同じコマンドで足し引きする(マイナス可)
import { appendExpense, type ExpenseCategory } from "./lib/ledger";

async function main(): Promise<void> {
  const [category, service, amount, description, date] = process.argv.slice(2);
  const m = /^(-?\d+(?:\.\d+)?)(usd|jpy)$/i.exec(amount ?? "");
  if (!["ads", "domain", "legal", "misc", "api"].includes(category) || !service || !m || !description) {
    console.error('使い方: npm run ledger:add -- <ads|domain|legal|misc|api> <サービス名> <金額 例 21usd / 3000jpy> "<内容>" [YYYY-MM-DD]');
    process.exitCode = 1;
    return;
  }
  const n = Number(m[1]);
  const usd = m[2].toLowerCase() === "usd";
  const e = await appendExpense({
    category: category as ExpenseCategory,
    service,
    amountUsd: usd ? n : null,
    amountJpy: usd ? null : n,
    description,
    occurredAt: date ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10),
  });
  console.log(`記帳: ${e.occurredAt} ${e.category} ${e.service} ${e.amountJpy ?? "-"}円${e.amountUsd != null ? ` (${e.amountUsd}ドル)` : ""} ${e.description}`);
}
void main();
