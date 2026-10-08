import type { PassState, TogeEvent } from "./types";

// 前回の状態が無い峠は「基準」として取り込むだけで出来事にしない(見張り開始直後に通知が大量に出るのを防ぐ)
export function detectEvents(prev: Map<string, PassState>, next: Map<string, PassState>, now: string): TogeEvent[] {
  const events: TogeEvent[] = [];
  for (const [passId, after] of next) {
    const before = prev.get(passId) ?? null;
    if (!before) continue;
    const push = (type: TogeEvent["type"]) => events.push({ passId, type, before, after, detectedAt: now });

    // 開通は発表元が解除済みと明記した時だけ(予定日を過ぎただけでは開通にしない)
    if (after.status === "open" && before.status !== "open") {
      push("reopened");
      continue;
    }
    if (after.status === "closed" && before.status !== "closed") push("closed");
    if (after.status !== "open" && after.reopenAt && after.reopenAt !== before.reopenAt) {
      push(before.reopenAt ? "reopen_changed" : "reopen_announced");
    }
    if (after.status === "closing_planned" && after.closeAt && after.closeAt !== before.closeAt) push("closing_announced");
  }
  return events;
}

// 通知の対象。閉鎖開始は一覧の表示を変えるだけで通知しない(仕様書2-5)
export const NOTIFY_TYPES = new Set<TogeEvent["type"]>(["reopen_announced", "reopen_changed", "reopened", "closing_announced"]);
