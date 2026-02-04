import { MetaType } from "../../src/meta-type.mts";
import { addFactionPatchesToItemGenerators } from "./addFactionPatchesToItemGenerators.mts";
import { addFactionPatchItems } from "./addFactionPatchItems.mts";

export const meta: MetaType = {
  description: `Adds Faction Patches as a simple item. Drops from dead bodies. `,
  changenote: "Initial release",
  structTransformers: [addFactionPatchItems, addFactionPatchesToItemGenerators],
};
