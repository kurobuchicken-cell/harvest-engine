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
