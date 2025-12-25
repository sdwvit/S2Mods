import { MetaType } from "../../src/meta-type.mts";
import { WeaponPrototype } from "s2cfgtojson";
import { getTemplate } from "../../src/backfill-def.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<WeaponPrototype> = {
  description: `
Allow any weapon to fit pistol slot.
[hr][/hr]
bPatches WeaponPrototypes.cfg
`,
  changenote: "Initial release",
  structTransformers: [transformWeaponPrototypes],
};

export function transformWeaponPrototypes(struct: WeaponPrototype) {
  const fork = struct.fork();

  if (getTemplate(struct, allDefaultWeaponPrototypesRecord) !== "TemplatePistol") {
    fork.ItemSlotType = "EInventoryEquipmentSlot::Pistol";
  }

  if (fork.entries().length) {
    return fork;
  }
}

transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];
