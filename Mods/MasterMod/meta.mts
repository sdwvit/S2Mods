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
 [*] [Challenge] NPCs bodies don't give stash clues, instead you have to do recurring vendor quests to receive stashes 
 [*] [Challenge] No enemy markers. No threat indicators.
 [*] [Challenge] Armors don't take head slot (except for SEVA's), but also don't protect from PSY damage, so you need to use helmets.
 [*] [Challenge] Reduced 💊 Consumables, 🔫 Ammo, and 💣 Grenades drops from bodies and stashes.
 [*] [Challenge] 🥠 7674 destructible objects now don't drop items (🍔 Wooden Boxes, 🍔 Plywood Crates, 🩹 Metal Crates, 🔫 Wooden Ammo Crates).
 [*] [Challenge] 🪃 431 instances of preplaced weapons or armor were removed (no more falcon / exo rush).
 [*] [Challenge] 💊 97 instances of preplaced medkits were removed.
 [*] [Challenge] 🧰 1166 instances of stashes were nerfed (10-100x less consumables). 
 [*] [Challenge] Traders are not allowed to sell gear.
 [*] [Challenge] Increases cost of everything to 400% (💣 ammo, 🛠️ repair, ⚙️ upgrade, 🍺 consumables, 🛡️ armor, 🔫 weapon, 🔮 artifact).
 [*] [Challenge] Traders or Bartenders are not allowed to buy gear. Regular stalkers can buy gear, but only at almost full or better durability and at 0.15x price.
 [*] [Challenge] Enemy's weapons damage is increased to be on par with player's weapons.
 [*] [Challenge / Balance] 🔪🗡🦟️ Increase given and taken damage on Hard difficulty to 400%.
 [*] [Challenge / QoL] Way more lively zone, now spawning all mutant bosses and bigger battles.
 [*] [QoL] Prevents Player and NPCs from being knocked down. Removes Fall damage for Player and NPCs.
 [*] [QoL] Water no longer slows you down or drains your stamina.
 [*] [QoL] X8 Scope compatible with more weapons. For X16 scopes use my other mod called X16Scopes.
 [*] [QoL] Unlocks blocking upgrades. 
 [*] [QoL] Satiety effect now lasts as long as on normal difficulty, as it was more like a slowdown and not a challenge.
 [*] [QoL] Unique weapons are now compatible with basic scopes.
 [*] [QoL] Allows buying/selling/dropping quest items.
 [*] [QoL] Allow unlimited saves on Master (Stalker) difficulty (same as Veteran (Hard)). Re-enables compass, and unlocks settings.
 [*] [QoL] Removes instakill effect from invisible border guards as well as spawned guards.
 [*] [QoL/Balance] There is now no cooldown between repeatable quests.
 [*] [Balance] Makes some consumables last longer, with the same value (antirad removes radiation slowly, 10x longer, but with the same value).
 [*] [Balance] Removes armor from vanilla mutants.
 [*] [Balance] NPCs drop armor, but it is damaged and will cost a lot to repair.
 [*] [Balance] Increases cost of Attachments to 1000%.
 [*] [Balance] Repeatable Quest Rewards are increased to 400%, but are made random with 25% spread both ways.
 [*] [Balance] Rifles default scopes can now be detached and sold.
 [*] [Balance] Unique and fair rewards for each possible variant of repeating quests.
[/list]
This mods works well with UBER TOZ mod. It does include Better Ballistics mod changes.
[hr][/hr]  
All changes have been tested against fresh save file. Some of these changes won't work with older saves.`,
  changenote: `Integrated mods:
- CanBeKnockedDown
- NoFallDamage
- X16Scopes
- NoSluggishWater
- NoAPForMobs
- GlassCanon`,
  structTransformers: structTransformers as any,
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
  onFinish(): void | Promise<void> {
    logger.log(Object.keys(MergedStructs).length);
  },
};
