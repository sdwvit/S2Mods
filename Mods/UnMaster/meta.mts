import { MetaContext, MetaType } from "../../src/metaType.mjs";
import { DifficultyPrototype, Struct } from "s2cfgtojson";

export const meta: MetaType<DifficultyPrototype> = {
  description: `
Quality of Life changes for Master difficulty. 
[hr][/hr]
Brings back unlimited saves, compass, and unlocks settings on Master difficulty.[h1][/h1]
Rest of Master specific things are left intact.[h1][/h1]
[hr][/hr]
bpatches DifficultyPrototypes
`,
  changenote: "Fix save limits",
  structTransformers: [structTransformer],
};

function structTransformer(struct: DifficultyPrototype, context: MetaContext<DifficultyPrototype>) {
  if (struct.SID !== "Stalker") {
    return null;
  }
  const fork = struct.fork();
  fork.AllowedSaveTypes = context.structsById.Hard.AllowedSaveTypes;
  fork.TotalSaveLimits = new Struct() as any;
  fork.bShouldDisableCompass = false;
  fork.BlockSettings = false;
  return fork;
}

structTransformer.files = ["/DifficultyPrototypes.cfg"];
