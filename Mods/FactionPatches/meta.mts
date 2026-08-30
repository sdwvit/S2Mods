import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformQuestNodePDANodes } from "./transformQuestNodePDANodes.mts";
import { addFactionPatchItems } from "./addFactionPatchItems.mts";

export const meta: MetaType = {
  description: `
Adds Faction Patches as a simple item. Drops from dead bodies. 
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote:
    "Updated for game version 2.0: patch icons are now shipped from the mod's own content mount (/FactionPatches/...) instead of overriding base-game /Game/ paths, which fixes missing/blank faction patch icons. Also added a faction patch drop to the neutral sniper item generator.",
  structTransformers: [addFactionPatchItems, transformItemGeneratorPrototypes, transformQuestNodePDANodes],
};
