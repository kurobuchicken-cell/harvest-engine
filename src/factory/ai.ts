import Anthropic from "@anthropic-ai/sdk";
import { appendExpense, fetchUsdJpyRate, readAllEntries } from "../lib/ledger";

// 2026-10-05オーナー決定: 1ジャンル1回あたり100円、出口工場の全ジャンル合計で月1,500円
export const RUN_LIMIT_JPY = 100;
export const MONTH_LIMIT_JPY = 1500;
// 出口工場のAI費はledgerのserviceを"pilot-"で始める(月の合計を出すため)
const FACTORY_SERVICE_PREFIX = "pilot-";

const PRICES_PER_M_USD: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
};

const jstMonth = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).slice(0, 7);

// 上限は呼び出しの前に判定するため、最後の1回分(数円程度)だけ上限を超えうる
export class AiBudget {
  spentUsd = 0;
  exceeded: string | null = null;

  constructor(
    readonly usdJpy: number | null,
    readonly monthSpentJpy: number,
  ) {}

  static async load(now = new Date()): Promise<AiBudget> {
    const entries = await readAllEntries();
    const latestRate = entries
      .filter((e) => e.fxRate !== null)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]?.fxRate ?? null;
    const usdJpy = latestRate ?? (await fetchUsdJpyRate()).rate;
    const month = jstMonth(now);
    const monthSpentJpy = entries
      .filter((e) => e.service.startsWith(FACTORY_SERVICE_PREFIX) && jstMonth(new Date(e.occurredAt)) === month)
      .reduce((sum, e) => sum + (e.amountJpy ?? (e.amountUsd !== null && usdJpy ? e.amountUsd * usdJpy : 0)), 0);
    return new AiBudget(usdJpy, monthSpentJpy);
  }

  get spentJpy(): number {
    return this.usdJpy ? this.spentUsd * this.usdJpy : 0;
  }

  canSpend(): boolean {
    if (this.exceeded) return false;
    if (!this.usdJpy) {
      this.exceeded = "為替レートが取得できず費用を円換算できないため、AI処理を止めました";
    } else if (this.spentJpy >= RUN_LIMIT_JPY) {
      this.exceeded = `1回の上限${RUN_LIMIT_JPY}円に達しました(今回${Math.round(this.spentJpy)}円)`;
    } else if (this.monthSpentJpy + this.spentJpy >= MONTH_LIMIT_JPY) {
      this.exceeded = `月の上限${MONTH_LIMIT_JPY}円に達しました(今月${Math.round(this.monthSpentJpy + this.spentJpy)}円)`;
    }
    if (this.exceeded) console.warn(`[ai] ${this.exceeded}`);
    return !this.exceeded;
  }
}

export class AiSession {
  inputTokens = 0;
  outputTokens = 0;
  private client: Anthropic | null = null;

  constructor(
    private readonly budget: AiBudget,
    private readonly service: string,
    readonly model: string,
  ) {
    if (!PRICES_PER_M_USD[model]) throw new Error(`price unknown for model ${model}`);
  }

  get costUsd(): number {
    const price = PRICES_PER_M_USD[this.model];
    return (this.inputTokens * price.input + this.outputTokens * price.output) / 1_000_000;
  }

  // 予算を超えていればnullを返す(呼び出し側は残りを処理せず次回に回す)
  async create(params: Omit<Anthropic.MessageCreateParamsNonStreaming, "model">): Promise<Anthropic.Message | null> {
    if (!this.budget.canSpend()) return null;
    this.client ??= new Anthropic();
    const response = await this.client.messages.create({ ...params, model: this.model });
    this.inputTokens += response.usage.input_tokens;
    this.outputTokens += response.usage.output_tokens;
    this.budget.spentUsd += this.costFor(response.usage);
    return response;
  }

  async record(description: string): Promise<void> {
    if (this.costUsd <= 0) return;
    await appendExpense({
      category: "api",
      service: this.service,
      amountUsd: this.costUsd,
      amountJpy: null,
      description: `${description}(in=${this.inputTokens} out=${this.outputTokens})`,
      occurredAt: new Date().toISOString(),
    });
  }

  private costFor(usage: Anthropic.Usage): number {
    const price = PRICES_PER_M_USD[this.model];
    return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
  }
}

export function responseText(response: Anthropic.Message): string {
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : "{}";
}
