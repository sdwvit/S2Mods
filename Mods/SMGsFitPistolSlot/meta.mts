import { MetaType } from "../../src/meta-type.mts";
import { WeaponPrototype } from "s2cfgtojson";
import { getTemplate } from "../../src/backfill-def.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<WeaponPrototype> = {
  description: `
Allow SMGs to fit into pistol slot.
[hr][/hr]
So you can triple wield SMGs[h1][/h1]
[hr][/hr]
bPatches WeaponPrototypes.cfg
`,
  changenote: "Initial release",
  structTransformers: [transformWeaponPrototypes],
};

export function transformWeaponPrototypes(struct) {
  const fork = struct.fork();

  if (getTemplate(struct, allDefaultWeaponPrototypesRecord) === "TemplateSMG") {
    fork.ItemSlotType = "EInventoryEquipmentSlot::Pistol";
  }

  if (fork.entries().length) {
    return fork;
  }
}

transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];
