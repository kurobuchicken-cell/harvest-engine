import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CouncilResult } from "./types";

const OUTPUT_DIR = path.resolve(process.cwd(), "council-output");
const DISALLOWED_FILENAME_CHARS = /[\\/:*?"<>|\s]+/g;

function slugify(topic: string): string {
  const cleaned = topic.replace(DISALLOWED_FILENAME_CHARS, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "topic").slice(0, 60);
}

function buildPromptMarkdown(result: CouncilResult): string {
  const scoreLines = result.scoreTable
    .map((item) => `- **${item.criterion}**: ${item.assessment}`)
    .join("\n");

  return `# 新テーマ調査: ${result.topic}(自動評議会採択、調査フェーズのみ)

## 背景と目的
自動評議会パイプラインが、テーマH(ビジネスヒントのメタ・ハーヴェスト)の差分検知から
このキーワードを候補として抽出し、評議会(市場戦略家/リスク管理官/ハーヴェスト理論の番人/
地域リサーチャー/運用・財務担当/監査役)の審議で「採択」と裁定した。

- キーワード: ${result.topic}
- 元記事タイトル抜粋: ${result.candidate.excerpt}
- 出典URL: ${result.candidate.sourceUrls.join(", ")}
- 評議会裁定日時: ${result.generatedAt}

### 評議会の裁定表
${scoreLines || "(裁定表なし)"}

### 監査役コメント
${result.auditorComment}

## スコープ
1. 上記キーワードに関連する実際の情報源(公式サイト・ニュース・フォーラム等)を実地調査する
2. 買い手仮説・競合状況・データ取得可否(robots.txt/実地fetch可否/RSS・API有無)を確認する
3. F/G/Hと同じ判定手順(robots.txt尊重・実地fetch分類・RSS/API優先・更新頻度目安)で
   一覧化して報告する

## 制約
- 礼儀規律は既存のまま(robots.txt尊重・ホスト単位同時接続1・UAに連絡先明記・
  5xx/429のみ指数バックオフ最大3回)
- 実装前に一度方針を提示し、承認後に着手すること
- このプロンプトは自動生成されたものであり、CCへの投入はオーナーが内容を確認したうえで
  手動で行うこと(自動評議会の裁定を鵜呑みにせず、着手前に一度目視確認する)
`;
}

export async function generateInvestigationPrompt(result: CouncilResult): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${slugify(result.topic)}.md`);
  await writeFile(filePath, buildPromptMarkdown(result), "utf-8");
  return filePath;
}
