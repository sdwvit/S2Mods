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
import { transformQuestRewardsPrototypes } from "./transformQuestRewardsPrototypes.mts";
import { transformRelationPrototypes } from "./transformRelationPrototypes.mts";
import { transformStashPrototypes } from "./transformStashPrototypes.mts";
import { transformUpgradePrototypes } from "./transformUpgradePrototypes.mts";
import { transformWeaponGeneralSetupPrototypes } from "./transformWeaponGeneralSetupPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformWeaponPrototypes } from "./transformWeaponPrototypes.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
import type { MetaType } from "../../src/meta-type.mts";
import { transformNPCPrototypes } from "./transformNPCPrototypes.mts";
import { transformDynamicItemGenerator } from "./transformItemGenerator.mts";
import { transformTradePrototypes } from "./transformTradePrototypes.mts";

const structTransformers = [
  transformNPCPrototypes,
  transformAttachPrototypes,
  transformBarbedWirePrototypes,
  transformDialogPoolPrototypes,
  transformDialogPrototypes,
  transformDifficultyPrototypes,
  transformDynamicItemGenerator,
  transformEffectPrototypes,
  transformGlobalVariablePrototypes,
  transformItemGeneratorPrototypes,
  transformMeshGeneratorPrototypes,
  transformNPCWeaponSettingsPrototypes,
  transformQuestArtifactPrototypes,
  transformQuestItemPrototypes,
  transformQuestNodePrototypes,
  transformQuestRewardsPrototypes,
  transformRelationPrototypes,
  transformStashPrototypes,
  transformTradePrototypes,
  transformUpgradePrototypes,
  transformWeaponGeneralSetupPrototypes,
  transformWeaponPrototypes,
] as const;

export const finishedTransformers = new Set<string>();

export const meta: MetaType<Parameters<(typeof structTransformers)[number]>[0]> = {
  description: `A collection of various configs aimed to increase game difficulty and make it more interesting.[h3][/h3]
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
 [*] [QoL] Allows buying/selling/dropping quest items.
 [*] [Balance] Unique and fair rewards for each possible variant of repeating quests.
[/list]`,
  changenote: `GeneralNPCs have faction-scaled money, buy weapons/armor only at 99%+ durability. Removed zombie lair population changes.`,
  structTransformers: structTransformers as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
  onFinish(): void | Promise<void> {},
};
