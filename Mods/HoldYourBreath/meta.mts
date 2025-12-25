import { MetaType } from "../../src/meta-type.mts";
import { AttachPrototype, Struct } from "s2cfgtojson";

export const meta: MetaType<Struct> = {
  description: `
Allows you to hold your breath while aiming with any scope or sight.[h3][/h3]
[hr][/hr]
bPatches AttachPrototypes.cfg
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: AttachPrototype) {
  const fork = struct.fork();
  fork.CanHoldBreath = true;
  return fork;
}

structTransformer.files = ["/AttachPrototypes.cfg"];
