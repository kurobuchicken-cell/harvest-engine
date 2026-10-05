// 収集対象は前月・当月・翌月(JST基準)。発売済みの直近分と発表済みの次月分を拾うため
export function targetMonths(now = new Date()): string[] {
  const [y, m] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).split("-").map(Number);
  return [-1, 0, 1].map((offset) => {
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function toReleaseMonth(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}`;
}

export function weekStart(ym: string, day: number): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(day).padStart(2, "0")}`;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&trade;/g, "™").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
