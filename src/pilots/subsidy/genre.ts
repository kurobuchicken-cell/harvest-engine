import { sourceFailure, type Genre } from "../../factory/genre";
import { collectApi } from "../../factory/kinds/api";
import { jgrantsSource, normalizeSourceFields } from "./collectJgrants";
import { collectJnet21, kindFromSubject } from "./collectJnet21";
import { classifyPending } from "./classify";
import { generateSite } from "./generate";
import { unknownValues } from "./taxonomy";
import type { SubsidyItem } from "./types";

export const subsidyGenre: Genre<SubsidyItem> = {
  id: "subsidy",
  kind: "api",
  // 片方の情報源が落ちていても、もう片方の収集・ページ生成は続ける
  collect: async (store) => [
    await collectApi(jgrantsSource, store).catch((err) => sourceFailure("jgrants", err)),
    // J-Net21はRSSが最新数十件しか載らないため、取得のたびに蓄積する
    await collectJnet21(store).then((seen) => ({ sourceId: "jnet21", seen, ok: true }), (err) => sourceFailure("jnet21", err)),
  ],
  enrich: classifyPending,
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
