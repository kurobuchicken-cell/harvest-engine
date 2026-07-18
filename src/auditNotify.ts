import { postSlackJson } from "./lib/slackWebhook";
import type { AuditResult } from "./auditReport";

function hasAnomaly(result: AuditResult): boolean {
  return (
    result.failures.length > 0 ||
    result.unresolvedEntries.length > 0 ||
    (result.council.startedRecently && result.council.recentCouncilEntryCount === 0)
  );
}

function buildBlocks(result: AuditResult, mentionUserId: string | undefined): unknown[] {
  const anomaly = hasAnomaly(result);
  const mention = mentionUserId && anomaly ? `<@${mentionUserId}> ` : "";

  const lines: string[] = [];

  if (result.failures.length === 0) {
    lines.push("✅ 記帳失敗ログ: 検出なし");
  } else {
    const total = result.failures.reduce((sum, f) => sum + f.lines.length, 0);
    lines.push(`⚠️ 記帳失敗ログ: ${result.failures.length}ファイルで計${total}件検出`);
  }

  if (result.unresolvedEntries.length === 0) {
    lines.push("✅ 為替レート未解決エントリ: なし");
  } else {
    lines.push(`⚠️ 為替レート未解決エントリ: ${result.unresolvedEntries.length}件`);
  }

  if (result.council.startedRecently && result.council.recentCouncilEntryCount === 0) {
    lines.push("⚠️ 評議会週次実行の形跡はあるが、対応するledgerエントリが見つかりません(要確認)");
  } else if (!result.council.startedRecently) {
    lines.push("・ 直近8日以内の評議会実行ログなし(またはこの環境にログ自体が無い)");
  } else {
    lines.push(`✅ 評議会週次実行とledgerの突合: OK(直近8日でcouncil-opusエントリ${result.council.recentCouncilEntryCount}件)`);
  }

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `${anomaly ? "⚠️" : "✅"} 監査役 週次バッチ` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `${mention}${lines.join("\n")}` },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `実行日時: ${new Date().toISOString()}` }],
    },
  ];
}

export async function notifyAuditResult(result: AuditResult): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[audit/notify] SLACK_WEBHOOK_URL未設定のため通知をスキップします");
    return;
  }
  const mentionUserId = process.env.SLACK_MENTION_USER_ID;
  const anomaly = hasAnomaly(result);

  await postSlackJson(webhookUrl, {
    text: `${anomaly ? "⚠️" : "✅"} 監査役 週次バッチ結果`,
    blocks: buildBlocks(result, mentionUserId),
  });
}
