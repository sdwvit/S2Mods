import { transformBarbedWirePrototypes } from "./transformBarbedWirePrototypes.mts";
import { transformAttachPrototypes } from "./transformAttachPrototypes.mts";
import { transformDialogPoolPrototypes } from "./transformDialogPoolPrototypes.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformDifficultyPrototypes } from "./transformDifficultyPrototypes.mts";
import { transformEffectPrototypes } from "./transformEffectPrototypes.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";
import { transformLairPrototypes } from "./transformLairPrototypes.mts";
import { transformMeshGeneratorPrototypes } from "./transformMeshGeneratorPrototypes.mts";
import { transformNPCWeaponSettingsPrototypes } from "./transformNPCWeaponSettingsPrototypes.mts";
import { transformQuestArtifactPrototypes } from "./transformQuestArtifactPrototypes.mts";
import { transformQuestItemPrototypes } from "./transformQuestItemPrototypes.mts";
import { transformQuestObjPrototypes } from "./transformQuestObjPrototypes.mts";
import { transformQuestRewardsPrototypes } from "./transformQuestRewardsPrototypes.mts";
import { transformRelationPrototypes } from "./transformRelationPrototypes.mts";
import { transformStashPrototypes } from "./transformStashPrototypes.mts";
import { transformTradePrototypes } from "./transformTradePrototypes.mts";
import { transformUpgradePrototypes } from "./transformUpgradePrototypes.mts";
import { transformWeaponGeneralSetupPrototypes } from "./transformWeaponGeneralSetupPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformWeaponPrototypes } from "./transformWeaponPrototypes.mts";
import { MetaType } from "../../src/meta-type.mts";
import { transformNPCPrototypes } from "./transformNPCPrototypes.mts";
import { logger } from "../../src/logger.mts";
import { MergedStructs } from "../../src/merged-structs.mts";
import { transformMobs } from "./transformMobs.mts";
import { transformDynamicItemGenerator } from "./transformItemGenerator.mts";

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
  transformLairPrototypes,
  transformMeshGeneratorPrototypes,
  transformMobs,
  transformNPCWeaponSettingsPrototypes,
  transformQuestArtifactPrototypes,
  transformQuestItemPrototypes,
  transformQuestNodePrototypes,
  transformQuestObjPrototypes,
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
 [*] [Challenge] Traders or Bartenders are not allowed to buy gear. Regular stalkers can buy gear, but only at >=99% durability.
 [*] [Challenge] Enemy's weapons damage is increased to be on par with player's weapons.
 [*] [QoL] X8 Scope compatible with more weapons. For X16 scopes use my other mod called X16Scopes.
 [*] [QoL] Unlocks blocking upgrades. 
 [*] [QoL] Satiety effect now lasts as long as on normal difficulty, as it was more like a slowdown and not a challenge.
 [*] [QoL] Unique weapons are now compatible with basic scopes. 
 [*] [Balance] Rifles default scopes can now be detached and sold.
 [*] [QoL] Allows buying/selling/dropping quest items.
 [*] [Balance] Unique and fair rewards for each possible variant of repeating quests.
[/list]`,
  changenote: `Refactor difficulty prototypes, reduce rewards back to 1x`.trim(),
  structTransformers: structTransformers as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
  onFinish(): void | Promise<void> {
    logger.log(Object.keys(MergedStructs).length);
  },
};
