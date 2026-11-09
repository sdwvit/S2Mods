import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformQuestNodePDANodes } from "./transformQuestNodePDANodes.mts";
import { addFactionPatchItems } from "./addFactionPatchItems.mts";

export const meta: MetaType = {
  description: `
Adds Faction Patches as a simple item. Drops from dead bodies.
`,
  changenote:
    "Faction patches now have localized names and descriptions in all 18 game languages instead of showing raw SIDs.",
  structTransformers: [
    addFactionPatchItems,
    transformItemGeneratorPrototypes,
    transformQuestNodePDANodes,
  ],
};
