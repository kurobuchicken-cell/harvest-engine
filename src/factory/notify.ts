import { postSlackJson } from "../lib/slackWebhook";

// 2026-10-05オーナー決定: 異常があった回だけ通知する(正常な回はログと実行記録のみ)
export async function notifyAnomalies(title: string, lines: string[], context: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[factory/notify] SLACK_WEBHOOK_URL未設定のため通知をスキップします");
    return;
  }
  const mentionUserId = process.env.SLACK_MENTION_USER_ID;
  const mention = mentionUserId ? `<@${mentionUserId}> ` : "";
  await postSlackJson(webhookUrl, {
    text: `⚠️ ${title}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `⚠️ ${title}` } },
      { type: "section", text: { type: "mrkdwn", text: `${mention}${lines.map((l) => `• ${l}`).join("\n")}`.slice(0, 2900) } },
      { type: "context", elements: [{ type: "mrkdwn", text: context }] },
    ],
  });
}
