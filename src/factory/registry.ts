import type { Genre } from "./genre";
import { priceGenre } from "../pilots/price/genre";
import { gachaGenre } from "../pilots/gacha/genre";
import { subsidyGenre } from "../pilots/subsidy/genre";

// 定期実行はこの順に1ジャンルずつ動かす(補助金は詳細APIの取得が最も長いため最後)
export const GENRES: Genre<{ id: string }>[] = [priceGenre, gachaGenre, subsidyGenre] as unknown as Genre<{ id: string }>[];

export function findGenre(id: string): Genre<{ id: string }> {
  const genre = GENRES.find((g) => g.id === id);
  if (!genre) throw new Error(`unknown genre: ${id}(${GENRES.map((g) => g.id).join(" / ")})`);
  return genre;
}
