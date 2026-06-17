import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformQuestNodePDANodes } from "./transformQuestNodePDANodes.mts";
import { addFactionPatchItems } from "./addFactionPatchItems.mts";

export const meta: MetaType = {
  description: `Adds Faction Patches as a simple item. Drops from dead bodies. `,
  changenote:
    "Fixed disappearing quest PDAs (e.g. Garbage Factory Camp StrangePDA): no longer inject refreshing loot buckets into quest/corpse generators, and flip ReplaceInventory off on quest SetItemGenerator nodes whose body also receives a PDA so the quest item survives.",
  structTransformers: [addFactionPatchItems, transformItemGeneratorPrototypes, transformQuestNodePDANodes],
};
