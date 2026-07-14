import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformQuestNodePDANodes } from "./transformQuestNodePDANodes.mts";
import { addFactionPatchItems } from "./addFactionPatchItems.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
Adds Faction Patches as a simple item. Drops from dead bodies. 
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Fixed disappearing quest PDAs (e.g. Garbage Factory Camp StrangePDA): no longer inject refreshing loot buckets into quest/corpse generators, and flip ReplaceInventory off on quest SetItemGenerator nodes whose body also receives a PDA so the quest item survives.",
  structTransformers: [addFactionPatchItems, transformItemGeneratorPrototypes, transformQuestNodePDANodes],
};
