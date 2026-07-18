import https from "node:https";
import { URL } from "node:url";
import type { CouncilResult, CouncilVerdictLabel } from "./types";

const VERDICT_EMOJI: Record<CouncilVerdictLabel, string> = {
  採択: "🟢",
  却下: "🔴",
  保留: "🟡",
};

function escapeSlack(text: string): string {
  return (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildBlocks(result: CouncilResult, mentionUserId: string | undefined): unknown[] {
  const emoji = VERDICT_EMOJI[result.verdict];
  const mention = mentionUserId ? `<@${mentionUserId}> ` : "";
  const scoreLines =
    result.scoreTable.length > 0
      ? result.scoreTable.map((item) => `• *${escapeSlack(item.criterion)}*: ${escapeSlack(item.assessment)}`).join("\n")
      : "(裁定表のパースに失敗。round2Textを直接確認してください)";

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} 評議会裁定: ${result.topic}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${mention}*裁定: ${result.verdict}*\n出典: ${result.candidate.sourceUrls.join(", ")}`,
      },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: scoreLines },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*監査役コメント*\n${escapeSlack(result.auditorComment)}` },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `見積コスト: 約${result.estimatedCostJpy.toFixed(1)}円 / 生成日時: ${result.generatedAt}`,
        },
      ],
    },
  ];
}

async function postJson(webhookUrl: string, payload: unknown, attempt = 1): Promise<void> {
  const parsed = new URL(webhookUrl);
  const body = Buffer.from(JSON.stringify(payload));

  try {
    await new Promise<void>((resolve, reject) => {
      const req = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": body.length },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) resolve();
            else reject(new Error(`Slack HTTP ${res.statusCode}: ${data}`));
          });
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return postJson(webhookUrl, payload, attempt + 1);
  }
}

export async function notifyCouncilVerdict(result: CouncilResult): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[council/notify] SLACK_WEBHOOK_URL未設定のため通知をスキップします");
    return;
  }
  const mentionUserId = process.env.SLACK_MENTION_USER_ID;
  if (!mentionUserId) {
    console.warn("[council/notify] SLACK_MENTION_USER_ID未設定のためメンションなしで通知します");
  }
  const mention = mentionUserId ? `<@${mentionUserId}> ` : "";

  await postJson(webhookUrl, {
    // textはプッシュ通知プレビュー用のフォールバック。blocks内にもメンションを含める
    text: `${mention}評議会裁定: ${result.topic}(${result.verdict})`,
    blocks: buildBlocks(result, mentionUserId),
  });
}
