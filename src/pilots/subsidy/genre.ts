import { sourceFailure, type Genre } from "../../factory/genre";
import { collectApi } from "../../factory/kinds/api";
import { jgrantsSource, normalizeSourceFields } from "./collectJgrants";
import { kindFromSubject } from "./collectJnet21";
import { classifyPending } from "./classify";
import { generateSite } from "./generate";
import { unknownValues } from "./taxonomy";
import type { SubsidyItem } from "./types";

export const subsidyGenre: Genre<SubsidyItem> = {
  id: "subsidy",
  kind: "api",
  // J-Net21は中小機構の利用規約が商業目的での利用(アクセス含む)を禁止しているため2026-10-06に停止。
  // 収集済みデータは保存に残るが、AI分類・掲載はしない
  collect: async (store) => [await collectApi(jgrantsSource, store).catch((err) => sourceFailure("jgrants", err))],
  enrich: (store, budget) => classifyPending(new Map([...store].filter(([, i]) => i.source !== "jnet21")), budget),
  prepare: (store) => {
    for (const item of store.values()) {
      if (item.sourceFields) Object.assign(item, normalizeSourceFields(item.sourceFields));
      if (item.source === "jnet21" && item.rawText) item.kind = kindFromSubject(item.rawText.split("\n")[0]);
    }
  },
  generate: async (store, now) => {
    const result = await generateSite(store, now);
    if (unknownValues.size > 0) {
      console.warn(`[taxonomy] 語彙に無い値 ${unknownValues.size}種(taxonomy.tsへの追加を検討):`, [...unknownValues]);
    }
    return result;
  },
};
