import type { Genre } from "../../factory/genre";
import { collectCatalog } from "../../factory/kinds/catalog";
import { bandaiMaker } from "./collectBandai";
import { takaraTomyArtsMaker } from "./collectTakaraTomyArts";
import { enrichPending } from "./enrich";
import { generateSite } from "./generate";
import type { GachaItem } from "./types";

export const gachaGenre: Genre<GachaItem> = {
  id: "gacha",
  kind: "catalog",
  collect: (store) => collectCatalog([bandaiMaker, takaraTomyArtsMaker], store),
  enrich: enrichPending,
  generate: generateSite,
};
