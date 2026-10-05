import { politeFetch, type FetchResult } from "../lib/politeness";

// politeFetch本体のタイムアウトはリトライ込みで最長約4分になるため、パイロットではさらに短い上限で打ち切る
export async function fetchWithTimeout(url: string, ms = 45_000): Promise<FetchResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<FetchResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: null, body: null, error: `timeout_${ms}ms` }), ms);
  });
  try {
    return await Promise.race([politeFetch(url), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// 国内企業サイトにはShift_JIS/EUC-JPのページが残っているため、meta charsetを見て復号する
export function decodeHtml(buf: Buffer): string {
  const head = buf.subarray(0, 4096).toString("latin1");
  const charset = head.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
  const label = /shift[_-]?jis|sjis|windows-31j|cp932/.test(charset) ? "shift_jis" : /euc-?jp/.test(charset) ? "euc-jp" : "utf-8";
  try {
    return new TextDecoder(label).decode(buf);
  } catch {
    return buf.toString("utf-8");
  }
}

export function isPdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

export function htmlToText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0];
  // <main>が空に近く本文がその外にあるサイト(カゴメ等)があるため、短すぎる場合はページ全体を使う
  const mainText = main ? stripToText(main) : "";
  return mainText.length >= 200 ? mainText : stripToText(html);
}

function stripToText(body: string): string {
  return body
    .replace(/<(script|style|noscript|nav|header|footer|svg)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t　]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
