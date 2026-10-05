import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Page {
  relPath: string;
  html: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function linkList(entries: { href: string; label: string; count: number }[]): string {
  return `<ul class="links">${entries
    .filter((e) => e.count > 0)
    .map((e) => `<li><a href="${e.href}">${escapeHtml(e.label)}</a> <span class="count">(${e.count})</span></li>`)
    .join("")}</ul>`;
}

export const siteDir = (genreId: string) => path.resolve(process.cwd(), "site", genreId);

// 前回生成分に今回存在しないページが残らないよう、出力先(そのジャンルの生成物のみ)を作り直す
export async function writeSite(outDir: string, pages: Page[], extraFiles: Record<string, string>): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const page of pages) {
    const file = path.join(outDir, page.relPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page.html, "utf-8");
  }
  for (const [name, content] of Object.entries(extraFiles)) {
    await writeFile(path.join(outDir, name), content, "utf-8");
  }
}
