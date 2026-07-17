import { prisma } from "../lib/prisma";
import type { IncidentModel } from "../../generated/prisma/models/Incident";

// テーマC(国内SaaS障害)公開ページ第一弾の対象8社。Sourceにテーマを表すカラムが無いため、
// スキーマ変更はせずここにハードコードで持たせる(将来テーマが増えたらschemaへの
// フィールド追加を検討する)
export const THEME_C_SERVICES: string[] = [
  "サイボウズ kintone",
  "サイボウズ Office",
  "サイボウズ Garoon",
  "サイボウズ メールワイズ",
  "freee",
  "Slack",
  "Notion",
  "Zendesk",
];

// 実レスポンス形式にアダプタが未対応でincidents=0件のまま止まっているサービス(HANDOFF.md記載の既知の制約)。
// 「稼働中」と誤解されないよう、これらは「データ準備中」として明示的に区別して表示する
export const KNOWN_PARSER_LIMITATION = new Set(["Slack", "Notion", "Zendesk"]);

export interface ServiceStatus {
  companyName: string;
  latestIncident: IncidentModel | null;
  isDataPending: boolean;
  isOngoing: boolean;
}

export async function getServiceStatuses(): Promise<ServiceStatus[]> {
  const statuses: ServiceStatus[] = [];
  for (const companyName of THEME_C_SERVICES) {
    const latestIncident = await prisma.incident.findFirst({
      where: { service: companyName },
      orderBy: { startedAt: "desc" },
    });
    // 「直近1件」だけでなく未解決件数を別途確認する。通知の非同期性で古い未解決incidentが
    // 新しい解決済みincidentより後にpubDateを持つ場合があり、直近1件のみの判定だと見落とすため
    const unresolvedCount = await prisma.incident.count({
      where: { service: companyName, resolvedAt: null },
    });
    statuses.push({
      companyName,
      latestIncident,
      isDataPending: KNOWN_PARSER_LIMITATION.has(companyName) && latestIncident === null,
      isOngoing: unresolvedCount > 0,
    });
  }
  return statuses;
}

export async function getServiceHistory(
  companyName: string,
): Promise<{ incidents: IncidentModel[]; isDataPending: boolean } | null> {
  if (!THEME_C_SERVICES.includes(companyName)) {
    return null;
  }
  const incidents = await prisma.incident.findMany({
    where: { service: companyName },
    orderBy: { startedAt: "desc" },
  });
  return {
    incidents,
    isDataPending: KNOWN_PARSER_LIMITATION.has(companyName) && incidents.length === 0,
  };
}
