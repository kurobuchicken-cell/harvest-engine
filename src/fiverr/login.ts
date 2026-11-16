import http from "node:http";
import { loadClient, saveToken, SCOPE, TOKEN_PATH } from "./gmail";

// 家PCで1回だけ流す。kurobuchicken@gmail.com で同意すると tokens/fiverr_gmail_token.json ができ、それを VM に写す。
// 同意画面が「テスト中」だと7日で切れるので、本番にしてから流す(auto_x-app HISTORY.md の invalid_grant)
const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

async function main(): Promise<void> {
  const { clientId, clientSecret } = loadClient();
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      login_hint: "kurobuchicken@gmail.com",
    });
  console.log(`このURLを開いて kurobuchicken@gmail.com で同意する:\n${authUrl}\n`);

  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", REDIRECT);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      try {
        if (!code) throw new Error(`同意されなかった: ${url.searchParams.get("error")}`);
        const r = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
        });
        const body = (await r.json()) as Record<string, any>;
        if (!r.ok || !body.refresh_token) throw new Error(`トークンを取れなかった: ${body.error ?? r.status}`);
        saveToken({ refresh_token: body.refresh_token, access_token: body.access_token, expires_at: Date.now() + body.expires_in * 1000 });
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("完了しました。このタブは閉じてかまいません。");
        console.log(`保存した: ${TOKEN_PATH}`);
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("失敗しました。ターミナルを見てください。");
        server.close();
        reject(err);
      }
    });
    server.listen(PORT, "127.0.0.1");
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
