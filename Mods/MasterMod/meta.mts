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
 [*] [Balance] On Hard and Stalker, player weapons hit harder and human enemies have matching extra health, so big mutants take a fair number of shots while gunfights stay the same.
[/list]
`,
  changenote: `On Hard and Stalker, big mutants now go down in a fair number of shots, while human enemies take as many hits as before.`,
  structTransformers: structTransformers as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
  onFinish(): void | Promise<void> {},
};
