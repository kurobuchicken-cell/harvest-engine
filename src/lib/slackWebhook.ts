import https from "node:https";
import { URL } from "node:url";

export async function postSlackJson(webhookUrl: string, payload: unknown, attempt = 1): Promise<void> {
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
    return postSlackJson(webhookUrl, payload, attempt + 1);
  }
}
