import type { IncidentModel } from "../../generated/prisma/models/Incident";
import type { ServiceStatus } from "./queries";

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function sourceLink(url: string | null): string {
  if (!url) return "";
  return ` <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">[出典]</a>`;
}

const DISCLAIMER =
  "本サイトは各社の公開情報を自動収集した非公式のまとめです。公式情報ではありません。" +
  "正確性・最新性を保証するものではなく、各サービスの正式な状況は各社公式ページをご確認ください。" +
  "誤りにお気づきの場合はご連絡ください。";

const STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 900px; margin: 0 auto; padding: 1.5em; line-height: 1.6; }
  header a { font-weight: bold; text-decoration: none; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { text-align: left; padding: 0.5em 0.75em; border-bottom: 1px solid #8884; }
  .badge { display: inline-block; padding: 0.15em 0.6em; border-radius: 1em; font-size: 0.85em; }
  .badge.ok { background: #1f8a4c22; color: #1f8a4c; }
  .badge.ongoing { background: #d1343422; color: #d13434; }
  .badge.pending { background: #8884; color: #666; }
  footer { margin-top: 2em; color: #666; font-size: 0.85em; }
`;

function layout(title: string, description: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${STYLE}</style>
</head>
<body>
<header><a href="/">国内SaaS障害モニタ(テーマC)</a></header>
<main>${body}</main>
<footer><small>${escapeHtml(DISCLAIMER)}</small></footer>
</body>
</html>`;
}

function statusBadge(status: ServiceStatus): string {
  if (status.isDataPending) return `<span class="badge pending">データ準備中</span>`;
  if (status.isOngoing) return `<span class="badge ongoing">障害発生中</span>`;
  return `<span class="badge ok">稼働中</span>`;
}

export function renderTopPage(statuses: ServiceStatus[]): string {
  const rows = statuses
    .map((s) => {
      const latestText = s.latestIncident
        ? `${escapeHtml(s.latestIncident.title ?? "(タイトル無し)")}(${formatDate(s.latestIncident.startedAt)})${sourceLink(s.latestIncident.sourceUrl)}`
        : "記録なし";
      return `<tr>
        <td><a href="/services/${encodeURIComponent(s.companyName)}">${escapeHtml(s.companyName)}</a></td>
        <td>${statusBadge(s)}</td>
        <td>${latestText}</td>
      </tr>`;
    })
    .join("\n");

  const body = `
    <h1>国内SaaS障害モニタ(テーマC)</h1>
    <p>サイボウズ kintone/Office/Garoon/メールワイズ、freee、Slack、Notion、Zendesk、計8サービスの障害・メンテナンス情報の現況です。</p>
    <table>
      <thead><tr><th>サービス</th><th>現況</th><th>直近の記録</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return layout(
    "国内SaaS障害モニタ | harvest-engine",
    "サイボウズ kintone・Office・Garoon・メールワイズ、freee、Slack、Notion、Zendeskの障害・メンテナンス現況一覧",
    body,
  );
}

export function renderServicePage(
  companyName: string,
  incidents: IncidentModel[],
  isDataPending: boolean,
): string {
  const title = `${companyName}の障害履歴 | harvest-engine`;
  const description = `${companyName}の障害・メンテナンス情報の時系列一覧(発生日時・解決日時)`;

  if (isDataPending) {
    const body = `
      <p><a href="/">&larr; 一覧へ戻る</a></p>
      <h1>${escapeHtml(companyName)}の障害履歴</h1>
      <p class="badge pending">データ準備中</p>
      <p>このサービスは現在パーサーが実際のレスポンス形式に対応できておらず、incidentsを検出できていません。
      「障害が発生していない」という意味ではなく、収集の仕組みが未対応であることを示しています。対応が完了次第このページに反映されます。</p>
    `;
    return layout(title, description, body);
  }

  if (incidents.length === 0) {
    const body = `
      <p><a href="/">&larr; 一覧へ戻る</a></p>
      <h1>${escapeHtml(companyName)}の障害履歴</h1>
      <p class="badge ok">記録されている障害はありません</p>
    `;
    return layout(title, description, body);
  }

  const rows = incidents
    .map((i) => {
      const resolved = i.resolvedAt !== null;
      return `<tr>
        <td>${formatDate(i.startedAt)}</td>
        <td>${formatDate(i.resolvedAt)}</td>
        <td>${escapeHtml(i.title ?? "(タイトル無し)")}</td>
        <td>${resolved ? `<span class="badge ok">解決済み</span>` : `<span class="badge ongoing">未解決</span>`}</td>
        <td>${i.sourceUrl ? `<a href="${escapeHtml(i.sourceUrl)}" target="_blank" rel="noopener noreferrer">出典</a>` : "—"}</td>
      </tr>`;
    })
    .join("\n");

  const body = `
    <p><a href="/">&larr; 一覧へ戻る</a></p>
    <h1>${escapeHtml(companyName)}の障害履歴</h1>
    <p>${incidents.length}件の記録(新しい順)</p>
    <table>
      <thead><tr><th>発生日時</th><th>解決日時</th><th>タイトル</th><th>状態</th><th>出典</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  return layout(title, description, body);
}

export function renderNotFound(): string {
  return layout(
    "ページが見つかりません | harvest-engine",
    "指定されたサービスは対象外です",
    `<p><a href="/">&larr; 一覧へ戻る</a></p><h1>404 Not Found</h1><p>指定されたサービスは対象外です。</p>`,
  );
}
