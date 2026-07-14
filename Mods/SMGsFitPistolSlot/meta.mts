import type { MetaType } from "../../src/meta-type.mts";
import type { WeaponPrototype } from "s2cfgtojson";
import { getTemplate } from "../../src/backfill-def.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<WeaponPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
Allow SMGs to fit into pistol slot.
[hr][/hr]
So you can triple wield SMGs[h1][/h1]
[hr][/hr]
bPatches WeaponPrototypes.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
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
