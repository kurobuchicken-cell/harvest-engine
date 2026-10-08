import type { Genre } from "../../factory/genre";
import { analyzePages } from "./analyze";
import { generateData } from "./generate";
import type { TogePage } from "./types";
import { ACTIVE_SOURCES, watchAll } from "./watch";

export const togeGenre: Genre<TogePage> = {
  id: "toge",
  kind: "announcement",
  collect: watchAll,
  enrich: (store, budget) => analyzePages(store, new Set(ACTIVE_SOURCES.map((s) => s.id)), budget),
  generate: generateData,
};
