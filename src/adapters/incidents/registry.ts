import type { IncidentAdapter } from "./types";
import { parseSlackIncidents } from "./slack";
import { parseNotionIncidents } from "./notion";
import { parseZendeskIncidents } from "./zendesk";
import { parseCybozuRssIncidents } from "./cybozuRss";
import { parseFreeeIncidents } from "./hund";

// Source.companyNameをキーにしたアダプタ登録。将来A/Eの他社パーサーもここに追加する
export const incidentAdapters: Record<string, IncidentAdapter> = {
  Slack: parseSlackIncidents,
  Notion: parseNotionIncidents,
  Zendesk: parseZendeskIncidents,
  "サイボウズ kintone": parseCybozuRssIncidents,
  "サイボウズ Office": parseCybozuRssIncidents,
  "サイボウズ Garoon": parseCybozuRssIncidents,
  "サイボウズ メールワイズ": parseCybozuRssIncidents,
  freee: parseFreeeIncidents,
};
