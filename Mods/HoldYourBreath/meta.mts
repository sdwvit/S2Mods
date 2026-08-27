import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { AttachPrototype } from "s2cfgtojson";

export const meta: MetaType<Struct> = {
  description: `
Allows you to hold your breath while aiming with any scope or sight.[h3][/h3]
[hr][/hr]
bPatches AttachPrototypes.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Updated for 2.0: patches regenerated against 2.0 game data.",
  structTransformers: [structTransformer],
};

function structTransformer(struct: AttachPrototype) {
  const fork = struct.fork();
  fork.CanHoldBreath = true;
  return fork;
}

structTransformer.files = ["/AttachPrototypes.cfg"];
