import type { MetaType } from "../../src/meta-type.mts";
import type { WeaponPrototype } from "s2cfgtojson";
import { getTemplate } from "../../src/backfill-def.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<WeaponPrototype> = {
  description: `
Allow any weapon to fit pistol slot.
[hr][/hr]
bPatches WeaponPrototypes.cfg
`,
  changenote:
    "Updated for 2.0: patches regenerated against 2.0 game data, now covering the weapons 2.0 added. DLC weapon prototypes are no longer patched.",
  structTransformers: [transformWeaponPrototypes],
};

export function transformWeaponPrototypes(struct: WeaponPrototype) {
  if (
    struct.SID === "UA_GLaunch_Weapon_Data_En" ||
    struct.SID === "UA_GLaunch_Weapon_Data_Ru" ||
    struct.SID === "EN_BuckLaunch_Data"
  ) {
    return;
  }

  const fork = struct.fork();

  if (getTemplate(struct, allDefaultWeaponPrototypesRecord) !== "TemplatePistol") {
    fork.ItemSlotType = "EInventoryEquipmentSlot::Pistol";
  }

  if (fork.entries().length) {
    return fork;
  }
}

transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];
transformWeaponPrototypes.dlc = false;
