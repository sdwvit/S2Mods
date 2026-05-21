import path from "node:path";
import dotEnv from "dotenv";
import type { MetaContext, MetaType } from "../../src/meta-type.mts";
import {
  type ArmorPrototype,
  type ERank,
  type ItemGeneratorPrototype,
  type ItemGeneratorPrototypeItemGeneratorItem,
  type ItemGeneratorPrototypePossibleItems,
  type ItemGeneratorPrototypePossibleItemsItem,
  type QuestNodePrototype,
  type QuestNodePrototypeSetItemGenerator,
  type SpawnActorPrototype,
  Struct,
} from "s2cfgtojson";

import {
  ALL_RANKS_ARR,
  allDefaultArmorPrototypesRecord,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
  FactionsByArmorSID,
  armorRanksBySID,
  type CoreFaction,
  getFactionFromItemGeneratorSID,
} from "../../src/consts.mts";
import { logger } from "../../src/logger.mts";
import { waitFor } from "../../src/wait-for.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";
import { backfillDef } from "../../src/backfill-def.mts";
import { deepMerge } from "../../src/deep-merge.mts";
import { getDropChance, maxDropChance } from "./calculateArmorScore.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
const finishedTransformers = new Set<string>();
export const meta: MetaType<
  ArmorPrototype | ItemGeneratorPrototype | QuestNodePrototype | SpawnActorPrototype
> = {
  description: `
    This mod adds armor that does not include helmets, forcing players to wear helmets to have adequate protection.[h2][/h2]
    It also adds corresponding helmets for exoskeleton and heavy armors, to balance things out.[h2][/h2]
    The armor has no psi and reduced radiation protection, you need to rely on helmets for that.[h2][/h2]
    NPCs can now drop armor and helmets, traders don't sell them.[h2][/h2]
    These are mostly post-SIRCAA armors and helmets. Thus you can't see them in the first half of the game[h2][/h2]
    The chance of NPCs dropping armor is based on the armor's overall effectiveness, with cheaper armors being more likely to drop.[h2][/h2]
    [h2][/h2]
    For your convenience, here is a set of console commands to spawn the new headless armors directly:[h2][/h2]
    [h1][/h1]
    Armors:
    [list]
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Dolg_Armor_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Dolg_Armor_headless
    [*] XSpawnItemNearPlayerBySID Heavy_Dolg_Armor_headless
    [*] XSpawnItemNearPlayerBySID Battle_Dolg_End_Armor_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Svoboda_Armor_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Svoboda_Armor_headless
    [*] XSpawnItemNearPlayerBySID Heavy_Svoboda_Armor_headless
    [*] XSpawnItemNearPlayerBySID Heavy_Mercenaries_Armor_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Mercenaries_Armor_headless
    [*] XSpawnItemNearPlayerBySID Heavy2_Military_Armor_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Monolith_Armor_headless
    [*] XSpawnItemNearPlayerBySID HeavyExoskeleton_Monolith_Armor_headless
    [*] XSpawnItemNearPlayerBySID HeavyAnomaly_Monolith_Armor_headless
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Neutral_Armor_headless
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Spark_Armor_headless
    [*] XSpawnItemNearPlayerBySID BattleExoskeleton_Varta_Armor_headless
    [/list]    [h1][/h1]
    Helmets: 
    [list]
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Duty_Helmet
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Dolg_Helmet
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Svoboda_Helmet
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Mercenaries_Helmet
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Merc_Helmet
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Monolith_Helmet
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Neutral_Helmet
    [*] XSpawnItemNearPlayerBySID Exoskeleton_Spark_Helmet
    [*] XSpawnItemNearPlayerBySID HeavyBattle_Spark_Helmet
    [/list] 
  `,
  changenote: `Rebalanced armor drop chances: max drop chance increased from 5% to 15%, and the minimum drop chance floor has been removed so very weak armors have near-zero chance. 
  Item generator slots that previously patched to empty are now removed entirely for cleaner loot table behavior. 
  NPC protection is now pre-scaled to account for armors being worn at 25% durability on average, so NPCs fight at appropriate effectiveness. 
  Dropped armor durability is now capped based on armor quality.
  Zombies and Guards no longer receive headless armor drops.`,
  structTransformers: [
    transformArmorPrototypes,
    transformItemGenerators,
    transformSkifItemGeneratorQuestNodes,
    transformSpawnActors,
  ],
  onTransformerFinish: (transformer) => {
    finishedTransformers.add(transformer.name);
  },
};

let addArmorsRunOnce = false;

const UPGRADE_SID_FIXUPS: Record<string, string> = {
  Battle_Monolith_Armor_rad_container_Left_3_2:
    "Battle_Monolith_Armor_radiationAbsorption_Left_3_2",
  Exoskeleton_Neutral_Armor_protectionChemical_protectionTherma_Left_3_2:
    "Exoskeleton_Neutral_Armor_protectionChemical_protectionElectrical_Left_3_2",
  HeavyExoskeleton_Monolith_Armor_protectionChemical_protectionTherma_Left_3_2:
    "HeavyExoskeleton_Monolith_Armor_protectionChemical_protectionElectrical_Left_3_2",
  Light_Mercenaries_Armor_protectionThermal_protectionElectrical_Left_2_1:
    "Light_Mercenaries_Armor_protectionChemical_protectionElectrical_Left_2_1",
  SEVA_Dolg_Armor_carryingCapacity_Left_2_2: "SEVA_Dolg_Armor_Backpack_Left_2_2",
};

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
export async function transformArmorPrototypes(
  struct: ArmorPrototype,
  context: MetaContext<ArmorPrototype>,
) {
  const extraStructs: ArmorPrototype[] = [];

  if (addArmorsRunOnce || context.array.length - 1 !== context.index) {
    return extraStructs;
  }

  addArmorsRunOnce = true;
  const seenSIDs = new Set<string>();
  const gdocsData = await getGdocsArmorData();
  const referenceMap = { ...allDefaultArmorPrototypesRecord, ...gdocsData.overrides };
  seenSIDs.union(new Set(Object.keys(gdocsData.descriptors)));
  Object.keys(gdocsData.descriptors).forEach((SID) => {
    const newArmor = createArmorPrototype(SID, referenceMap);
    if (!newArmor) {
      logger.warn(`Couldn't create new armor due to no ref? ${SID}`);
      return;
    }

    fixUpgradePrototypeSIDs(newArmor);
    dedupeUpgradePrototypeSIDs(newArmor);

    const clone = newArmor.clone();
    clone.__internal__.isRoot = true;
    extraStructs.push(clone);
  });

  return extraStructs;
}

transformArmorPrototypes.files = ["/ArmorPrototypes.cfg"];

function fixUpgradePrototypeSIDs(armor: ArmorPrototype) {
  const upgrades = armor.UpgradePrototypeSIDs;
  if (!upgrades || typeof upgrades.entries !== "function") {
    return;
  }
  for (const [key, value] of upgrades.entries()) {
    if (typeof value !== "string") {
      continue;
    }
    const replacement = UPGRADE_SID_FIXUPS[value];
    if (replacement && replacement !== value) {
      upgrades[key] = replacement;
    }
  }
}

function dedupeUpgradePrototypeSIDs(armor: ArmorPrototype) {
  const upgrades = (armor as any).UpgradePrototypeSIDs?.fork(true);
  if (!upgrades || typeof upgrades.entries !== "function") {
    return;
  }
  const seen = new Set<string>();
  for (const [key, value] of upgrades.entries()) {
    if (typeof value !== "string") {
      continue;
    }
    if (seen.has(value)) {
      if (upgrades[key] instanceof Struct) {
        upgrades.removeNode(key);
      } else {
        delete upgrades[key];
      }
      continue;
    }
    seen.add(value);
  }
  armor.UpgradePrototypeSIDs = upgrades;
}

/**
 * Because NPCs sometimes can equip wrong armor, and drop whats intended for equipment, we need to adjust durability in both cases.
 * With dura loss comes protection loss, so adjust protection for npcs upfront to compensate.
 */
export function overrideProtectionNPCWithProtection(armor: ArmorPrototype): void {
  if (!armor?.Protection) {
    return;
  }
  armor.ProtectionNPC = armor.Protection.clone().map(([k, e]) => {
    if (k === "Strike") {
      return Math.min(5, e / NPC_AVG_DURABILITY);
    }
    return Math.min(80, e / NPC_AVG_DURABILITY);
  });
}

export function createArmorPrototype(SID: string, referenceMap: Record<string, ArmorPrototype>) {
  const override = referenceMap[SID];
  const refkey = override.__internal__.refkey;
  const referenceArmor = referenceMap[refkey];
  if (!referenceArmor) {
    return;
  }
  if (
    !referenceArmor.SID.toLowerCase().includes("helmet") &&
    SID.toLowerCase().includes("helmet")
  ) {
    logger.warn(
      `referenceArmor.SID '${referenceArmor.SID}' is not a helmet, even though SID '${SID}' points to a helmet`,
    );
  }
  const s = new Struct(override) as ArmorPrototype;

  const backfilled = backfillDef(s, referenceMap, referenceArmor.SID);

  deepMerge(backfilled, override, false);
  overrideProtectionNPCWithProtection(backfilled);
  backfilled.__internal__.rawName = SID;
  return backfilled;
}

export const NPC_AVG_DURABILITY = 0.25;

function shouldProcessStruct(struct: ItemGeneratorPrototype) {
  if (!struct?.ItemGenerator) {
    return false;
  }
  if (struct.SID === "empty" || struct.SID === "EmptyQuest") {
    return false;
  }
  if (/^all/i.test(struct.SID) || /^msdemo/i.test(struct.SID)) {
    return false;
  }
  if (/(trade|trader|bartender|medic|technician)/i.test(struct.SID)) {
    return false;
  }
  // Keep dedicated NVG generators untouched.
  if (/_NVG$/i.test(struct.SID)) {
    return false;
  }
  // Keep stash/body/utility generators untouched.
  if (/(stash|body|corpse|reward|queststash|stashbody)/i.test(struct.SID)) {
    return false;
  }

  return (
    allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID] ||
    allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID]
  );
}

let once = false;

type NewItemGeneratorsByPurpose = Record<
  "helmets" | "armors" | "allHelmets" | "allHeadedArmors" | "allHeadlessArmors" | "combos",
  Record<string, ItemGeneratorPrototype>
>;
const armorSIDSubItemGenInjectedPerFactionPerRankMap = {} as Record<
  ERank,
  Record<CoreFaction, NewItemGeneratorsByPurpose>
>;

function getRelevantItemGen(
  relevantItems: Record<string, ItemGeneratorPrototype>,
  faction: string,
  rank: string,
  sidSuffix: string,
  referenceMap: Record<string, ArmorPrototype>,
) {
  const igItem = new Struct({
    Category: "EItemGenerationCategory::SubItemGenerator",
    PossibleItems: new Struct(),
  }) as ItemGeneratorPrototypeItemGeneratorItem;
  Object.entries(relevantItems)
    .map(([SID, ig]) => ({
      ItemGeneratorPrototypeSID: ig.SID,
      Weight: getDropChance(referenceMap[SID]) / maxDropChance,
    }))
    .forEach((node) => igItem.PossibleItems.addNode(new Struct(node)));

  const subItemGen = new Struct({
    SID: `SubItemGen_for_${faction}_${rank.split("::").pop()}${sidSuffix}`,
    ItemGenerator: new Struct(),
    __internal__: { isRoot: true },
  }) as ItemGeneratorPrototype;
  subItemGen.__internal__.rawName = subItemGen.SID;
  subItemGen.ItemGenerator.addNode(igItem);

  return subItemGen;
}

const armorData = await getGdocsArmorData();
const referenceMap: Record<string, ArmorPrototype> = {
  ...allDefaultArmorPrototypesRecord,
  ...armorData.overrides,
};
const armorSIDs = [...Object.keys(armorRanksBySID), ...Object.keys(armorData.overrides)];
const backfilledArmors = armorSIDs.map((SID) => {
  const armor = createArmorPrototype(SID, referenceMap);
  referenceMap[SID] = armor;
  return armor;
});

function doOnce(extraStructs: any[]) {
  function getLowestLevelGenerators(SID: string, armor: ArmorPrototype) {
    const equippedSubItemGenItem = new Struct({
      Category: "EItemGenerationCategory::BodyArmor",
      bAllowSameCategoryGeneration: true,
      PossibleItems: new Struct(),
    }) as ItemGeneratorPrototypeItemGeneratorItem;
    const equipped = new Struct({
      ItemPrototypeSID: SID,
      Chance: 1,
      MinDurability: 0,
      MaxDurability: 0.59,
    }) as ItemGeneratorPrototypePossibleItemsItem;

    const droppable = equipped.clone();
    droppable.Chance = getDropChance(armor);

    const droppableSubItemGenItem = equippedSubItemGenItem.clone();
    equippedSubItemGenItem.PossibleItems.addNode(equipped);
    droppableSubItemGenItem.PossibleItems.addNode(droppable);
    droppableSubItemGenItem.Category = "EItemGenerationCategory::BodyArmor";

    const subItemGen = new Struct({
      SID: `SubItemGen_for_${SID}_end`,
      ItemGenerator: new Struct(),
      __internal__: { isRoot: true },
    }) as ItemGeneratorPrototype;
    subItemGen.__internal__.rawName = subItemGen.SID;
    subItemGen.ItemGenerator.addNode(equippedSubItemGenItem);
    subItemGen.ItemGenerator.addNode(droppableSubItemGenItem);

    return subItemGen;
  }

  backfilledArmors.forEach((armor) => {
    const SID = armor.SID;
    const subItemGenFaction = FactionsByArmorSID[SID] || armorData.descriptors[SID].Faction;
    const subItemGenRanks = (armorRanksBySID[SID] || armorData.descriptors[SID].Rank).split(
      ", ",
    ) as ERank[];

    // one equipped, one droppable
    const subItemGen = getLowestLevelGenerators(SID, armor);

    extraStructs.push(subItemGen);

    // fill out caches

    subItemGenRanks.forEach((rank) => {
      armorSIDSubItemGenInjectedPerFactionPerRankMap[rank] ||= {} as Record<
        CoreFaction,
        NewItemGeneratorsByPurpose
      >;
      armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction] ||= {
        helmets: {},
        armors: {},
        combos: {},
        allHelmets: {},
        allHeadedArmors: {},
        allHeadlessArmors: {},
      } satisfies NewItemGeneratorsByPurpose;

      if (SID.toLowerCase().includes("helmet")) {
        armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction].helmets[SID] =
          subItemGen;
      } else {
        armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction].armors[SID] =
          subItemGen;
      }
    });
  });

  // create a combo sub item generator for armor + helmet OR just armor
  // create a combo sub item generator for faction ranks so it’s easier to plug them into existing structs.
  for (const rank in armorSIDSubItemGenInjectedPerFactionPerRankMap) {
    const perFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[rank as ERank];
    Object.entries(perFaction).forEach(
      ([faction, itemsCol]: [CoreFaction, NewItemGeneratorsByPurpose]) => {
        const relevantHelmets = itemsCol.helmets;
        const relevantHelmetsSize = Object.keys(relevantHelmets).length;

        // create combo helmets
        if (relevantHelmetsSize) {
          const subItemGen = getRelevantItemGen(
            relevantHelmets,
            faction,
            rank,
            "_helmets",
            referenceMap,
          );
          extraStructs.push(subItemGen);
          itemsCol.allHelmets[subItemGen.SID] = subItemGen;
        }

        const relevantHeadedArmors = Object.fromEntries(
          Object.entries(itemsCol.armors).filter(([armorSID]) => {
            return !!referenceMap[armorSID].bBlockHead;
          }),
        );
        const relevantArmorsSize = Object.keys(relevantHeadedArmors).length;

        // create combo armors
        if (relevantArmorsSize) {
          const subItemGen = getRelevantItemGen(
            relevantHeadedArmors,
            faction,
            rank,
            "_headed_armors",
            referenceMap,
          );
          extraStructs.push(subItemGen);
          itemsCol.allHeadedArmors[subItemGen.SID] = subItemGen;
        }

        const relevantHeadlessArmors = Object.fromEntries(
          Object.entries(itemsCol.armors).filter(([armorSID]) => {
            return !referenceMap[armorSID].bBlockHead;
          }),
        );
        const relevantHeadlessArmorsSize = Object.keys(relevantHeadlessArmors).length;

        // create combo headless armors
        if (relevantHeadlessArmorsSize) {
          const subItemGen = getRelevantItemGen(
            relevantHeadlessArmors,
            faction,
            rank,
            "_headless_armors",
            referenceMap,
          );
          extraStructs.push(subItemGen);
          itemsCol.allHeadlessArmors[subItemGen.SID] = subItemGen;
        }

        // create armor helmet combos
        if (relevantHelmetsSize + relevantArmorsSize + relevantHeadlessArmorsSize) {
          const relevantAllHeadlessArmors = itemsCol.allHeadlessArmors;
          const allHeadlessArmorsIG = Object.values(relevantAllHeadlessArmors).pop();
          const relevantAllHeadlessArmorsLenght = Object.keys(relevantAllHeadlessArmors).length;

          if (relevantAllHeadlessArmorsLenght > 1) {
            throw new Error(
              `Got more relevantAllHeadlessArmors than expected ${Object.keys(relevantAllHeadlessArmors)}`,
            );
          }

          const relevantAllHelmets = itemsCol.allHelmets;
          const allHelmetsIG = Object.values(relevantAllHelmets).pop();
          const relevantAllHelmetsArmorsLength = Object.keys(relevantAllHelmets).length;

          if (relevantAllHelmetsArmorsLength > 1) {
            throw new Error(
              `Got more relevantAllHelmetsArmorsLength than expected ${Object.keys(relevantAllHelmets)}`,
            );
          }

          const comboSubItemGen = new Struct({
            SID: `SubItemGen_for_${faction}_${rank.split("::").pop()}_combo`,
            ItemGenerator: {},
            __internal__: { isRoot: true },
          }) as ItemGeneratorPrototype;
          comboSubItemGen.__internal__.rawName = comboSubItemGen.SID;

          const igItem = new Struct({
            Category: "EItemGenerationCategory::SubItemGenerator",
            PossibleItems: {},
          }) as ItemGeneratorPrototypeItemGeneratorItem;

          if (allHeadlessArmorsIG) {
            igItem.PossibleItems.addNode({
              ItemGeneratorPrototypeSID: allHeadlessArmorsIG.SID,
              Chance: 1,
            });
          }
          if (allHelmetsIG) {
            igItem.PossibleItems.addNode({
              ItemGeneratorPrototypeSID: allHelmetsIG.SID,
              Chance: 1,
            });
          }

          comboSubItemGen.ItemGenerator.addNode(igItem);
          itemsCol.combos[comboSubItemGen.SID] = comboSubItemGen;
          extraStructs.push(comboSubItemGen);
        }
      },
    );
  }
}

/**
 * Removes existing armor/helmet generation buckets and injects armor sub-item selectors by faction+rank.
 */
export async function transformItemGenerators(struct: ItemGeneratorPrototype, { filePath }) {
  if (!shouldProcessStruct(struct)) {
    return;
  }

  const extraStructs = [];
  if (!once && filePath.endsWith("/ItemGeneratorPrototypes.cfg")) {
    doOnce(extraStructs);
    once = true;
    return extraStructs;
  }
  await waitFor(() => once);

  const igFaction = getFactionFromItemGeneratorSID(struct.SID);
  if (struct.SID.includes("Guard") || struct.SID.includes("Zombie")) {
    return;
  }
  if (!igFaction) {
    logger.warn(`Can't guess faction, ${struct.SID}`);
    return;
  }
  const fork = struct.fork();
  fork.ItemGenerator = new Struct().fork() as any;
  resetCss(struct, fork);

  for (const rank of ALL_RANKS_ARR) {
    const perFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[rank as ERank];
    if (perFaction && igFaction === "Noon") {
      perFaction.Noon = perFaction.Monolith;
    }
    if (!perFaction || !perFaction[igFaction]) {
      logger.warn(`No armors to drop for igFaction '${igFaction}'`);
      return;
    }

    // either combo or headed armor! bingo!
    const relevantCombos = {
      ...perFaction[igFaction].combos,
      ...perFaction[igFaction].allHeadedArmors,
    };
    const relevantCombosLenght = Object.keys(relevantCombos).length;

    if (relevantCombosLenght) {
      const igItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
      igItem.Category = "EItemGenerationCategory::SubItemGenerator";
      igItem.PlayerRank = rank;
      igItem.PossibleItems = new Struct() as ItemGeneratorPrototypePossibleItems;
      for (const igSID in relevantCombos) {
        const possibleItem = new Struct() as ItemGeneratorPrototypePossibleItemsItem;
        possibleItem.ItemGeneratorPrototypeSID = igSID;
        possibleItem.Weight = 1;
        igItem.PossibleItems.addNode(possibleItem, igSID);
      }
      fork.ItemGenerator.addNode(igItem, `Armors_for_${rank.split("::").pop()}`);
    }
  }

  if (fork.ItemGenerator.entries().length) {
    extraStructs.push(fork);
  }
  transformItemGenerators.extraStructs.push(...extraStructs);
  return extraStructs;
}

/**
 * Removes any existing item generators
 */
function resetCss(struct: ItemGeneratorPrototype, fork: ItemGeneratorPrototype) {
  const dummy = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
  struct.ItemGenerator.forEach(([igIndex, ig]) => {
    if (
      ig.Category === "EItemGenerationCategory::BodyArmor" ||
      ig.Category === "EItemGenerationCategory::Head"
    ) {
      fork.ItemGenerator[igIndex] = dummy;
      fork.ItemGenerator.removeNode(igIndex);
    } else if (ig.Category === "EItemGenerationCategory::SubItemGenerator") {
      fork.ItemGenerator[igIndex] = dummy.fork(true);
      ig.PossibleItems.forEach(([k, pi]) => {
        if (pi.ItemGeneratorPrototypeSID.includes("Armor")) {
          fork.ItemGenerator[igIndex].PossibleItems =
            struct.ItemGenerator[igIndex].PossibleItems.fork();
          fork.ItemGenerator[igIndex].PossibleItems[k] =
            dummy as any as ItemGeneratorPrototypePossibleItemsItem;
          fork.ItemGenerator[igIndex].PossibleItems.removeNode(k);
        }
      });
    }
  });
}
transformItemGenerators.extraStructs = [] as Struct[];
transformItemGenerators.files = [
  "/DynamicItemGenerator.cfg",
  "/QuestItemGeneratorPrototypes.cfg",
  "/ItemGeneratorPrototypes.cfg",
];

/**
 * Removes OverrideRank from spawn actors so NPC loot is determined by the player's rank,
 * not a hardcoded NPC rank. Without this, HeadlessArmors can drop high-tier gear
 * (e.g. exoskeletons) from quest NPCs even when the player is at a low rank.
 */
export function transformSpawnActors(struct) {
  if (!struct.OverrideRank) {
    return null;
  }
  const fork = struct.fork();
  fork.OverrideRank = false;
  return fork;
}

transformSpawnActors.files = ["/SpawnActorPrototypes/"];
transformSpawnActors.contains = true;

const SKIF_QUEST_GUID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
let addQuestOnce = false;

function sanitizeSID(raw: string) {
  return raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/(GeneralNPC_|_ItemGenerator)/g, "");
}

async function getNewHeadlessGeneratorSIDs() {
  await waitFor(() => finishedTransformers.has(transformItemGenerators.name));
  return transformItemGenerators.extraStructs.map((e) => e.__internal__.rawName);
}

/**
 * Adds debug quest nodes that apply only NEW HeadlessArmors item generators to Skif.
 * Use with console: XStartQuestNodeBySID <GeneratedNodeSID>
 */
export async function transformSkifItemGeneratorQuestNodes(s) {
  if (addQuestOnce) {
    return;
  }
  addQuestOnce = true;

  const sids = await getNewHeadlessGeneratorSIDs();
  return sids.map((itemGeneratorSID) => {
    const nodeSID = `Skif_${sanitizeSID(itemGeneratorSID)}`;
    const node = new Struct() as QuestNodePrototypeSetItemGenerator;
    node.SID = nodeSID;
    node.QuestSID = s.QuestSID;
    node.NodeType = "EQuestNodeType::SetItemGenerator";
    node.TargetQuestGuid = SKIF_QUEST_GUID;
    node.ReplaceInventory = false;
    node.EquipItems = false;
    node.Repeatable = true;
    node.ItemGeneratorSID = itemGeneratorSID;
    node.__internal__.isRoot = true;
    node.__internal__.rawName = nodeSID;
    return node;
  });
}

transformSkifItemGeneratorQuestNodes.files = ["/QuestNodePrototypes/A-life_interrupts.cfg"];
