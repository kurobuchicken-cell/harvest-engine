import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// googleapis を入れずに fetch で Gmail API を読む(新しいパッケージを増やさないため)。
// 読むのは件名・差出人・日時だけ。本文とリンクは詐欺の連絡が多いので取らない(hq/scrutiny/fiverr-gigs.md)
const TOKENS_DIR = path.resolve(__dirname, "..", "..", "tokens");
export const CLIENT_PATH = path.join(TOKENS_DIR, "fiverr_gmail_client.json");
export const TOKEN_PATH = path.join(TOKENS_DIR, "fiverr_gmail_token.json");
export const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

interface StoredToken {
  refresh_token: string;
  access_token?: string;
  expires_at?: number;
}

export interface MailHeader {
  id: string;
  subject: string;
  from: string;
  receivedAt: number;
}

export class GmailAuthError extends Error {
  constructor(public code: string, detail: string) {
    super(`${code}: ${detail}`);
  }
}

export function loadClient(): { clientId: string; clientSecret: string } {
  const json = JSON.parse(readFileSync(CLIENT_PATH, "utf8"));
  const c = json.installed ?? json.web;
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

function loadToken(): StoredToken {
  if (!existsSync(TOKEN_PATH)) throw new GmailAuthError("no_token", `${TOKEN_PATH} が無い。npm run fiverr:login を流す`);
  return JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
}

export function saveToken(token: StoredToken): void {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2), { mode: 0o600 });
}

async function accessToken(): Promise<string> {
  const token = loadToken();
  if (token.access_token && token.expires_at && token.expires_at - 60_000 > Date.now()) return token.access_token;

  const { clientId, clientSecret } = loadClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new GmailAuthError(String(body.error ?? res.status), String(body.error_description ?? ""));

  // Google が新しい refresh_token を返したときに古いものを使い続けると invalid_grant になる(auto_x-app HISTORY.md の 2026-07-07)
  saveToken({
    refresh_token: (body.refresh_token as string) ?? token.refresh_token,
    access_token: body.access_token as string,
    expires_at: Date.now() + Number(body.expires_in) * 1000,
  });
  return body.access_token as string;
}

async function gmailGet(pathAndQuery: string): Promise<any> {
  const res = await fetch(`${API}${pathAndQuery}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function listMessageIds(q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ q, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await gmailGet(`/messages?${params}`);
    for (const m of data.messages ?? []) ids.push(m.id);
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return ids;
}

export async function getHeader(id: string): Promise<MailHeader> {
  const data = await gmailGet(`/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`);
  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const pick = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return { id, subject: pick("Subject") || "(件名なし)", from: pick("From"), receivedAt: Number(data.internalDate) };
}

export async function profileEmail(): Promise<string> {
  return (await gmailGet("/profile")).emailAddress;
}
