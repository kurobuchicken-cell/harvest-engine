import type { IncidentAdapter } from "./types";

// ページ上部の"issue-notice--wrapper"ブロックが現在進行中の障害・メンテナンス告知を表す
// (実データ<freee>で確認。statusクラスはinvestigating/maintenance/assessed/informational/
// upcoming/resolvedのいずれか)。無ければ全サービス稼働中でインシデント無しを意味する
const NOTICE_PATTERN =
  /<div class='issue-notice--header issue (\w+)'>\s*<div class='issue-notice--header__title'><a href="([^"]*)"[^>]*>([^<]+)<\/a><\/div>[\s\S]*?<div class='issue-notice--content__date'><time datetime='([^']+)'/g;

// Hund.ioは各locale向けhreflang="x-default"のalternateリンクで自サイトの絶対URLを常に出力しているため、
// これを起点にissue-noticeの相対href(/issues/ID)を絶対URLへ解決する
const BASE_URL_PATTERN = /<link href='([^']+)' hreflang='x-default' rel='alternate'>/;

// Hund.io系ステータスページ(freee等)共通の実装。将来別サービスでも同一プラットフォームであれば
// このアダプタをそのまま流用できる
export const parseHundIncidents: IncidentAdapter = (raw) => {
  const html = raw;
  if (typeof html !== "string" || !html.includes("state-bar")) {
    throw new Error("hund: raw content is not a Hund.io status page (unexpected response shape)");
  }

  const baseUrl = html.match(BASE_URL_PATTERN)?.[1] ?? null;

  const incidents = [];
  for (const match of html.matchAll(NOTICE_PATTERN)) {
    const [, status, href, titleRaw, dateRaw] = match;
    const title = titleRaw.trim();
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`hund: notice "${title}" has invalid date "${dateRaw}"`);
    }

    incidents.push({
      title,
      severity: status,
      startedAt: date,
      resolvedAt: status === "resolved" ? date : null,
      sourceUrl: baseUrl ? new URL(href, baseUrl).toString() : href || null,
    });
  }
  return incidents;
};

export const parseFreeeIncidents = parseHundIncidents;
