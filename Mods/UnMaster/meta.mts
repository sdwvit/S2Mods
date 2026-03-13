import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { DifficultyPrototype } from "s2cfgtojson";

export const meta: MetaType<DifficultyPrototype> = {
  description: `
Quality of Life changes for Master difficulty. 
[hr][/hr]
Brings back unlimited saves, compass, and unlocks settings on Master difficulty.[h1][/h1]
Rest of Master specific things are left intact.[h1][/h1]
[hr][/hr]
bpatches DifficultyPrototypes
`,
  changenote: "Show body markers",
  structTransformers: [structTransformer],
};

function structTransformer(struct: DifficultyPrototype, context: MetaContext<DifficultyPrototype>) {
  if (struct.SID !== "Hard" && struct.SID !== "Stalker") {
    return null;
  }
  const fork = struct.fork();
  fork.AllowedSaveTypes = context.structsById.Hard.AllowedSaveTypes;
  fork.TotalSaveLimits = new Struct() as any;
  fork.bShouldDisableCompass = false;
  fork.BlockSettings = false;
  fork.bShouldDisableDeadBodyMarkers = false;
  return fork;
}

structTransformer.files = ["/DifficultyPrototypes.cfg"];
