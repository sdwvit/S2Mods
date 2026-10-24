import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformWeaponGeneralSetupPrototypes } from "./transformWeaponGeneralSetupPrototypes.mts";
import { transformAttachPrototypes } from "./transformAttachPrototypes.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformAlifeinterrupts } from "./transformAlifeinterrupts.mts";

export const meta: MetaType<Struct> = {
  description: `
Drahunka takes the Three-Line Rifle's PU 3.5X scope again, so it works at range as well as up close.
[hr][/hr]
[list]
[*] Drahunka fits the PU 3.5X scope, and new copies come with it mounted.
[*] The PU 3.5X scope is now a regular attachment with its own icon, name and description in all languages (base cost 9500, weight 0.6 kg): detach it from any Three-Line Rifle, sell it or move it between rifles. If you already own Drahunka, take the scope off a regular Three-Line Rifle.
[/list]
[hr][/hr]
To get a scoped Drahunka and a spare scope in Skif's inventory, use the console command:
[code]XStartQuestNodeBySID Skif_ScopedDrahunka[/code]
[hr][/hr]
Compatible with UberToz, which makes the same scope detachable the same way.
[hr][/hr]
Logo photo: [url=https://commons.wikimedia.org/wiki/File:Mosin_pu_hungarian_M52.jpg]B4Ctom1, Wikimedia Commons[/url], CC BY-SA 3.0.
[hr][/hr]
bPatches WeaponGeneralSetupPrototypes, AttachPrototypes, ItemGeneratorPrototypes and A-life_interrupts quest nodes.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [
    transformWeaponGeneralSetupPrototypes,
    transformAttachPrototypes,
    transformItemGeneratorPrototypes,
    transformAlifeinterrupts,
  ] as MetaType<Struct>["structTransformers"],
};
