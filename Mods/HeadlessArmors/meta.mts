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
  type MeshPrototype,
  type QuestNodePrototypeSetItemGenerator,
  Struct,
  type UpgradePrototype,
} from "s2cfgtojson";

import {
  ALL_RANKS_ARR,
  allDefaultArmorPrototypesRecord,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  FactionsByArmorSID,
  armorRanksBySID,
  type CoreFaction,
  getFactionFromItemGeneratorSID,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
} from "../../src/consts.mts";
import { logger } from "../../src/logger.mts";
import { waitFor } from "../../src/wait-for.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";
import { backfillDef } from "../../src/backfill-def.mts";
import { deepMerge } from "../../src/deep-merge.mts";
import { getDropChance, maxDropChance } from "./calculateArmorScore.mts";

dotEnv.config({ path: path.join(import.meta.dirname, "..", ".env") });
const finishedTransformers = new Set<string>();
export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
    This mod adds armor that does not include helmets, forcing players to wear helmets to have adequate protection.[h2][/h2]
    It also adds corresponding helmets for exoskeleton and heavy armors, to balance things out.[h2][/h2]
    The armor has no psi and reduced radiation protection, you need to rely on helmets for that.[h2][/h2]
    NPCs can now drop armor and helmets, traders don't sell them.[h2][/h2]
    These are mostly post-SIRCAA armors and helmets. Thus you can't see them in the first half of the game[h2][/h2]
    The chance of NPCs dropping armor is based on the armor's overall effectiveness, with cheaper armors being more likely to drop.[h2][/h2]
    [h2][/h2]
    For your convenience, here is a console commands to spawn all new headless armors in Skif's inventory:
    [h2][/h2]
    [u]XStartQuestNodeBySID Skif_ItemGen_Skif_All_Gdocs_Armors[/u]
  
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,

  changenote: `Fixed the mod's own assets not loading: custom inventory icons and the exoskeleton helmet mesh/materials were still pointing at /Game/ paths that only exist inside this mod, so they showed up blank or missing. They now resolve from the mod's own /HeadlessArmors/ mount.`,
  structTransformers: [
    transformArmorPrototypes,
    transformItemGenerators,
    transformMeshPrototypes,
    transformSkifItemGeneratorQuestNodes,
    transformSpawnActors,
    transformUpgradePrototypes,
  ],
  onTransformerFinish: (transformer) => {
    finishedTransformers.add(transformer.name);
  },
};

let addArmorsRunOnce = false;
let headlessArmorBuildDataPromise: Promise<HeadlessArmorBuildData> | null = null;

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

const EXTRA_UPGRADES_FIXUPS = {
  HeavyExoskeleton_Dolg_Armor_headless: ["Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1"],
  HeavyExoskeleton_Svoboda_Armor_headless: ["Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1"],
  HeavyExoskeleton_Dolg_Armor: ["Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1"],
  HeavyExoskeleton_Svoboda_Armor: ["Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1"],
  Exoskeleton_Dolg_Armor: ["Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1"],
  Exoskeleton_Dolg_Armor_headless: ["Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1"],
};

type HeadlessArmorBuildData = {
  armorData: Awaited<ReturnType<typeof getGdocsArmorData>>;
  referenceMap: Record<string, ArmorPrototype>;
  gdocsArmorSIDs: string[];
  backfilledArmors: ArmorPrototype[];
};

async function getHeadlessArmorBuildData(): Promise<HeadlessArmorBuildData> {
  if (!headlessArmorBuildDataPromise) {
    headlessArmorBuildDataPromise = (async () => {
      const armorData = await getGdocsArmorData();
      const referenceMap: Record<string, ArmorPrototype> = {
        ...allDefaultArmorPrototypesRecord,
        ...armorData.overrides,
      };
      const gdocsArmorSIDs = Object.keys(armorData.descriptors);
      const armorSIDs = [...Object.keys(armorRanksBySID), ...Object.keys(armorData.overrides)];
      const backfilledArmors = armorSIDs.flatMap((SID) => {
        const armor = createArmorPrototype(SID, referenceMap);
        if (!armor) {
          logger.warn(`Couldn't create cached armor due to no ref? ${SID}`);
          return [];
        }
        referenceMap[SID] = armor;
        return [armor];
      });

      return {
        armorData,
        referenceMap,
        gdocsArmorSIDs,
        backfilledArmors,
      };
    })();
  }

  return headlessArmorBuildDataPromise;
}

function transformUpgradePrototypes(struct: UpgradePrototype) {
  if (struct.SID === "Exoskeleton_Svoboda_Armor_AddRunEffect_Right_2_1") {
    const fork = struct.fork();
    fork.RequiredUpgradePrototypeSIDs = new Struct() as any;
    return fork;
  }
}

transformUpgradePrototypes.files = ["/UpgradePrototypes.cfg"];

let transformMeshPrototypesOnce = false;

async function transformMeshPrototypes() {
  if (transformMeshPrototypesOnce) return null;
  transformMeshPrototypesOnce = true;

  const { armorData } = await getHeadlessArmorBuildData();

  return Object.values(armorData.meshPrototypes).map((mesh) => {
    const materials = new Struct();
    mesh.Materials.forEach((m) =>
      materials.addNode(new Struct({ MaterialSlot: m.MaterialSlot, MaterialPath: m.MaterialPath })),
    );
    return new Struct({
      __internal__: {
        rawName: mesh.SID,
        isRoot: true,
        refurl: "../MeshPrototypes.cfg",
        refkey: "[0]",
      },
      SID: mesh.SID,
      MeshPath: mesh.MeshPath,
      Materials: materials,
    }) as MeshPrototype;
  });
}

transformMeshPrototypes.files = ["/MeshPrototypes.cfg"];

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
export async function transformArmorPrototypes(
  struct: ArmorPrototype,
  context: MetaContext<ArmorPrototype>,
) {
  if (struct.SID === "HeavyBattle_Spark_Armor") {
    const fork = struct.fork();
    fork.Protection = struct.Protection.fork();
    fork.Protection.PSY = 20; // see comment in gdocs about HeavyBattle_Spark_Helmet PSY
    return fork;
  }

  if (EXTRA_UPGRADES_FIXUPS[struct.SID]) {
    const fork = struct.fork();
    fork.UpgradePrototypeSIDs = struct.UpgradePrototypeSIDs.fork();
    EXTRA_UPGRADES_FIXUPS[struct.SID].forEach((u) => fork.UpgradePrototypeSIDs.addNode(u, u));
    return fork;
  }

  const extraStructs: ArmorPrototype[] = [];

  if (addArmorsRunOnce || context.array.length - 1 !== context.index) {
    return extraStructs;
  }

  addArmorsRunOnce = true;
  const { gdocsArmorSIDs, referenceMap } = await getHeadlessArmorBuildData();
  gdocsArmorSIDs.forEach((SID) => {
    const newArmor = referenceMap[SID];
    if (!newArmor) {
      logger.warn(`Couldn't emit cached armor due to no ref? ${SID}`);
      return;
    }

    const clone = newArmor.clone();
    fixUpgradePrototypeSIDs(clone);
    dedupeUpgradePrototypeSIDs(clone);
    clone.__internal__.isRoot = true;
    delete clone.PreinstalledUpgrades;
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
  if (EXTRA_UPGRADES_FIXUPS[armor.SID]) {
    EXTRA_UPGRADES_FIXUPS[armor.SID].forEach((u) => upgrades.addNode(u, u));
  }
}

function dedupeUpgradePrototypeSIDs(armor: ArmorPrototype) {
  const upgrades = (armor as any).UpgradePrototypeSIDs;
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
  if (backfilled.bBlockHead === false && backfilled.UpgradePrototypeSIDs) {
    backfilled.UpgradePrototypeSIDs = backfilled.UpgradePrototypeSIDs?.filter(
      ([, e]) => e !== "FaustPsyResist_Quest_1_1",
    );
  }
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
const SKIF_ALL_GDOCS_ARMORS_GENERATOR_SID = "ItemGen_Skif_All_Gdocs_Armors";

type NewItemGeneratorsByPurpose = Record<
  "helmets" | "armors" | "allHelmets" | "allHeadedArmors" | "allHeadlessArmors" | "combos",
  Record<string, ItemGeneratorPrototype>
>;
const armorSIDSubItemGenInjectedPerFactionPerRankMap:
  | Record<ERank, Record<CoreFaction, NewItemGeneratorsByPurpose>>
  | {} = {};

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

const { armorData, gdocsArmorSIDs, referenceMap, backfilledArmors } =
  await getHeadlessArmorBuildData();

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

  const allGdocsArmorsItemGenerator = new Struct({
    SID: SKIF_ALL_GDOCS_ARMORS_GENERATOR_SID,
    ItemGenerator: new Struct(),
    __internal__: { isRoot: true },
  }) as ItemGeneratorPrototype;
  allGdocsArmorsItemGenerator.__internal__.rawName = allGdocsArmorsItemGenerator.SID;

  gdocsArmorSIDs.forEach((SID) => {
    const igItem = new Struct({
      Category: "EItemGenerationCategory::BodyArmor",
      bAllowSameCategoryGeneration: true,
      PossibleItems: new Struct(),
    }) as ItemGeneratorPrototypeItemGeneratorItem;
    igItem.PossibleItems.addNode(
      new Struct({
        ItemPrototypeSID: SID,
        Chance: 1,
        MinDurability: 1,
        MaxDurability: 1,
      }) as ItemGeneratorPrototypePossibleItemsItem,
      SID,
    );
    allGdocsArmorsItemGenerator.ItemGenerator.addNode(igItem, SID);
  });
  extraStructs.push(allGdocsArmorsItemGenerator);
  transformItemGenerators.extraStructs.push(allGdocsArmorsItemGenerator);

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

const loggedMissedDrops = {};
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

  ALL_RANKS_ARR.forEach((rank) => {
    const perFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[rank as ERank];
    if (perFaction && igFaction === "Noon") {
      perFaction.Noon = perFaction.Monolith;
    }
    // either combo or headed armor! bingo!
    // Include combos from all ranks up to and including the current rank so that
    // higher-rank players have equal possibility of getting lower-rank armors.
    const relevantCombos: Record<string, ItemGeneratorPrototype> = {};
    for (const r of ALL_RANKS_ARR.slice(0, ALL_RANKS_ARR.indexOf(rank as ERank) + 1)) {
      const rPerFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[r as ERank];
      if (rPerFaction && rPerFaction[igFaction]) {
        Object.assign(
          relevantCombos,
          rPerFaction[igFaction].combos,
          rPerFaction[igFaction].allHeadedArmors,
        );
      }
    }
    const relevantCombosLenght = Object.keys(relevantCombos).length;

    if (!relevantCombosLenght) {
      if (!loggedMissedDrops[igFaction + rank]) {
        loggedMissedDrops[igFaction + rank] = true;
        logger.warn(`No armors to drop for igFaction '${igFaction}' at rank ${rank}`);
      }
      return;
    }

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
  });

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
