import { transformBarbedWirePrototypes } from "./transformBarbedWirePrototypes.mts";
import { transformAttachPrototypes } from "./transformAttachPrototypes.mts";
import { transformDialogPoolPrototypes } from "./transformDialogPoolPrototypes.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformDifficultyPrototypes } from "./transformDifficultyPrototypes.mts";
import { transformEffectPrototypes } from "./transformEffectPrototypes.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformMeshGeneratorPrototypes } from "./transformMeshGeneratorPrototypes.mts";
import { transformNPCWeaponSettingsPrototypes } from "./transformNPCWeaponSettingsPrototypes.mts";
import { transformQuestArtifactPrototypes } from "./transformQuestArtifactPrototypes.mts";
import { transformQuestItemPrototypes } from "./transformQuestItemPrototypes.mts";
import { transformStashPrototypes } from "./transformStashPrototypes.mts";
import { transformUpgradePrototypes } from "./transformUpgradePrototypes.mts";
import { transformWeaponGeneralSetupPrototypes } from "./transformWeaponGeneralSetupPrototypes.mts";
import { transformWeaponPrototypes } from "./transformWeaponPrototypes.mts";
import type { MetaType } from "../../src/meta-type.mts";
import { transformNPCPrototypes } from "./transformNPCPrototypes.mts";
import { transformDynamicItemGenerator } from "./transformItemGenerator.mts";
import { transformTradePrototypes } from "./transformTradePrototypes.mts";
import { finishedTransformers } from "./finished-transformers.mts";

const structTransformers = [
  transformNPCPrototypes,
  transformAttachPrototypes,
  transformBarbedWirePrototypes,
  transformDialogPoolPrototypes,
  transformDialogPrototypes,
  transformDifficultyPrototypes,
  transformDynamicItemGenerator,
  transformEffectPrototypes,
  transformItemGeneratorPrototypes,
  transformMeshGeneratorPrototypes,
  transformNPCWeaponSettingsPrototypes,
  transformQuestArtifactPrototypes,
  transformQuestItemPrototypes,
  transformStashPrototypes,
  transformTradePrototypes,
  transformUpgradePrototypes,
  transformWeaponGeneralSetupPrototypes,
  transformWeaponPrototypes,
] as const;

export { finishedTransformers } from "./finished-transformers.mts";

export const meta: MetaType<Parameters<(typeof structTransformers)[number]>[0]> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
A collection of various configs aimed to increase game difficulty and make it more interesting.[h3][/h3]
[hr][/hr]
[h3]All changes to the base game:[/h3]
[list]
 [*] [Challenge] Reduced 💊 Consumables, 🔫 Ammo, and 💣 Grenades drops from bodies and stashes.  
 [*] [Challenge] Enemy's weapons damage is increased to be on par with player's weapons.
 [*] [QoL] X8 Scope compatible with more weapons. For X16 scopes use my other mod called X16Scopes.
 [*] [QoL] Unlocks blocking upgrades. 
 [*] [QoL] Satiety effect now lasts as long as on normal difficulty, as it was more like a slowdown and not a challenge.
 [*] [QoL] Unique weapons are now compatible with basic scopes. 
 [*] [Balance] Rifles default scopes can now be detached and sold.
 [*] [Challenge] Weapons that always came with a scope now spawn with one only 10% of the time.
 [*] [QoL] Allows buying/selling/dropping quest items.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: `Fixed the guns that shipped with a built-in scope keeping it: Gvintar's scope was permanent and could not be taken off, and the SVDM and Falcon scopes had no weight, cost or name. Those weapons now drop bare and their compatible scopes are the normal x4/x8 ones you can loot, mount and sell, still rolled at a 10% chance by the item generators. Unique scopes inherited from a parent weapon are also swapped for their generic equivalent, so the Cavalier can mount an x8 scope again`,
  structTransformers: structTransformers as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
  onFinish(): void | Promise<void> {},
};
