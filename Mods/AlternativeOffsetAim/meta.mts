import { MetaType } from "../../src/meta-type.mts";
import { WeaponGeneralSetupPrototype } from "s2cfgtojson";

export const meta: MetaType<WeaponGeneralSetupPrototype> = {
  description: `
Offset aim with any weapon any scope at any time. 
[hr][/hr]
bPatches WeaponGeneralSetupPrototypes.cfg
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
