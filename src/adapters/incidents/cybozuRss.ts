import Parser from "rss-parser";
import type { IncidentAdapter } from "./types";

const parser = new Parser();

// 実データ(kintone/Office/Garoon/メールワイズの各RSS)で確認したタイトル先頭の【】プレフィックス運用:
// 【復旧】【改修済】【対応完了】= 解決済み、プレフィックス無し = 未解決(調査中)の告知
function extractStatus(title: string): { severity: string | null; resolved: boolean } {
  const match = title.match(/^【([^】]+)】/);
  if (!match) return { severity: null, resolved: false };
  const prefix = match[1];
  return { severity: prefix, resolved: /(復旧|完了|済)/.test(prefix) };
}

// サイボウズの製品別障害RSS(kintone/Office/Garoon/メールワイズ)は共通のRSS 2.0フォーマットのため、
// 4製品とも本アダプタをそのままregistry.tsに登録して使う(product別の分岐は不要)
export const parseCybozuRssIncidents: IncidentAdapter = async (raw) => {
  if (typeof raw !== "string") {
    throw new Error("cybozu-rss: raw content is not a string (unexpected fetch result)");
  }

  const feed = await parser.parseString(raw);

  return (feed.items ?? []).map((item) => {
    const title = item.title?.trim();
    if (!title) {
      throw new Error("cybozu-rss: item missing title");
    }

    const pubDateRaw = item.pubDate ?? item.isoDate;
    if (!pubDateRaw) {
      throw new Error(`cybozu-rss: item "${title}" missing pubDate`);
    }
    const pubDate = new Date(pubDateRaw);
    if (Number.isNaN(pubDate.getTime())) {
      throw new Error(`cybozu-rss: item "${title}" has invalid pubDate "${pubDateRaw}"`);
    }

    const { severity, resolved } = extractStatus(title);

    return {
      title,
      severity,
      startedAt: pubDate,
      resolvedAt: resolved ? pubDate : null,
    };
  });
};
