import { transformAIGlobals } from "./transformAIGlobals.mts";
import { transformConsumablePrototypes } from "./transformConsumablePrototypes.mts";
import { transformALifeDirectorScenarioPrototypes } from "./transformALifeDirectorScenarioPrototypes.mts";
import { transformArtifactPrototypes } from "./transformArtifactPrototypes.mts";
import { transformBarbedWirePrototypes } from "./transformBarbedWirePrototypes.mts";
import { transformAttachPrototypes } from "./transformAttachPrototypes.mts";
import { transformDialogPoolPrototypes } from "./transformDialogPoolPrototypes.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformDifficultyPrototypes } from "./transformDifficultyPrototypes.mts";
import { transformDynamicItemGenerator } from "./transformDynamicItemGenerator.mts";
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
import { transformObjPrototypes } from "./transformObjPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformWeaponPrototypes } from "./transformWeaponPrototypes.mts";
import { MetaType } from "../../src/meta-type.mts";
import { transformNPCPrototypes } from "./transformNPCPrototypes.mts";
import { logger } from "../../src/logger.mts";
import { MergedStructs } from "../../src/merged-structs.mts";
import { transformCluePrototypes } from "../StashClueRework/meta.mts";
import { transformMobs } from "./transformMobs.mts";

const structTransformers = [
  transformNPCPrototypes,
  transformAIGlobals,
  transformConsumablePrototypes,
  transformALifeDirectorScenarioPrototypes,
  transformArtifactPrototypes,
  transformAttachPrototypes,
  transformBarbedWirePrototypes,
  transformCluePrototypes,
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
  transformObjPrototypes,
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
 [*] [Challenge] No enemy markers. No threat indicators.
 [*] [Challenge] Reduced 💊 Consumables, 🔫 Ammo, and 💣 Grenades drops from bodies and stashes. 
 [*] [Challenge] 🧰 1166 instances of stashes were nerfed (10-100x less consumables). 
 [*] [Challenge] Traders are not allowed to sell gear.
 [*] [Challenge] Increases cost of everything to 400% (💣 ammo, 🛠️ repair, ⚙️ upgrade, 🍺 consumables, 🛡️ armor, 🔫 weapon, 🔮 artifact).
 [*] [Challenge] Traders or Bartenders are not allowed to buy gear. Regular stalkers can buy gear, but only at almost full or better durability and at 0.15x price.
 [*] [Challenge] Enemy's weapons damage is increased to be on par with player's weapons.
 [*] [Challenge / QoL] Way more lively zone, now spawning all mutant bosses and bigger battles.
 [*] [QoL] X8 Scope compatible with more weapons. For X16 scopes use my other mod called X16Scopes.
 [*] [QoL] Unlocks blocking upgrades. 
 [*] [QoL] Satiety effect now lasts as long as on normal difficulty, as it was more like a slowdown and not a challenge.
 [*] [QoL] Unique weapons are now compatible with basic scopes. 
 [*] [Balance] Rifles default scopes can now be detached and sold.
 [*] [QoL] Allows buying/selling/dropping quest items.
 [*] [Balance] Increases cost of Attachments to 1000%.
 [*] [Balance] Repeatable Quest Rewards are increased to 400%, but are made random with 25% spread both ways.
 [*] [Balance] Unique and fair rewards for each possible variant of repeating quests.
[/list]
This mods works well with:
[list]
[*] X16Scopes
[*] CantBeKnockedDown
[*] GlassCannon
[*] NoSluggishWater
[*] NoFallDamage
[*] LongLastingBuffs
[*] NoAPForMobs
[*] StashClueRework
[*] NoQuestCooldown
[*] AnyWeaponFitsPistolSlot
[*] AlternativeOffsetAim
[*] CratesDontDropAnything
[*] HeadlessArmors
[*] NoPreplacedMedkits
[*] NoPreplacedArmorAndWeapons
[*] MoreSideQuestOptions
[*] RostokMutantRSQuestFix
[*] HoldYourBreath
[*] Unmaster
[*] NoInstaGibByGuards
[*] NoEnemyMarkers
[*] NoThreatMarkers 
[/list]
It does include Better Ballistics mod changes.
[hr][/hr]  
All changes have been tested against fresh save file. Some of these changes won't work with older saves.`,
  changenote: `Extract mods: 
- NoEnemyMarkers
- NoThreatMarkers 
`,
  structTransformers: structTransformers as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
  onFinish(): void | Promise<void> {
    logger.log(Object.keys(MergedStructs).length);
  },
};
