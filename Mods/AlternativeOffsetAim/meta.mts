import type { MetaType } from "../../src/meta-type.mts";
import type { WeaponGeneralSetupPrototype } from "s2cfgtojson";

export const meta: MetaType<WeaponGeneralSetupPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
Offset aim with any weapon any scope at any time. 
[hr][/hr]
bPatches WeaponGeneralSetupPrototypes.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

function structTransformer(struct: WeaponGeneralSetupPrototype) {
  const fork = struct.fork();
  fork.OffsetAimingConditionSID = "ConstTrue";
  fork.ToggleOffsetAimingConditionSID = "ConstTrue";
  return fork;
}

structTransformer.files = ["/WeaponGeneralSetupPrototypes.cfg"];
