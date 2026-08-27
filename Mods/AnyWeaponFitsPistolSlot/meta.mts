import type { MetaType } from "../../src/meta-type.mts";
import type { WeaponPrototype } from "s2cfgtojson";
import { getTemplate } from "../../src/backfill-def.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<WeaponPrototype> = {
  description: `
Allow any weapon to fit pistol slot.
[hr][/hr]
bPatches WeaponPrototypes.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Updated for 2.0: patches regenerated against 2.0 game data, now covering the weapons 2.0 added. DLC weapon prototypes are no longer patched.",
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
transformWeaponPrototypes.dlc = false;
