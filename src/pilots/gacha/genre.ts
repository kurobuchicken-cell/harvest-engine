import type { Genre } from "../../factory/genre";
import { collectCatalog } from "../../factory/kinds/catalog";
import { takaraTomyArtsMaker } from "./collectTakaraTomyArts";
import { enrichPending } from "./enrich";
import { generateSite } from "./generate";
import type { GachaItem } from "./types";

export const gachaGenre: Genre<GachaItem> = {
  id: "gacha",
  kind: "catalog",
  // バンダイはガシャポン公式のサイトご利用条件で自動取得・AI等による二次利用を事前許諾制にしているため
  // 2026-10-06に停止。収集済みデータは保存に残るが、AI処理・掲載はしない
  collect: (store) => collectCatalog([takaraTomyArtsMaker], store),
  enrich: (store, budget) => enrichPending(new Map([...store].filter(([, i]) => i.maker !== "bandai")), budget),
  generate: generateSite,
};
