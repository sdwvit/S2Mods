import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { addFactionPatchItems } from "./addFactionPatchItems.mts";

export const meta: MetaType = {
  description: `Adds Faction Patches as a simple item. Drops from dead bodies. `,
  changenote: "Updated to stay aligned with recent progression and balance changes.",
  structTransformers: [addFactionPatchItems, transformItemGeneratorPrototypes],
};
