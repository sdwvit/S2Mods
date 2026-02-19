import {
  EItemGenerationCategory,
  ERank,
  ItemGeneratorPrototype,
  ItemGeneratorPrototypeItemGenerator,
  ItemGeneratorPrototypeItemGeneratorItem,
  ItemGeneratorPrototypePossibleItems,
  ItemGeneratorPrototypePossibleItemsItem,
  Struct,
} from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import {
  ALL_RANKS_ARR,
  allDefaultArmorPrototypesRecord,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultItemGeneratorsRecord,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
  armorFactionsBySID,
  armorRanksBySID,
  CoreFaction,
  getFactionFromItemGeneratorSID,
  helmetFactionsBySID,
  helmetRanksBySID,
} from "../../src/consts.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";
import { createArmorPrototype } from "./transformArmorPrototypes.mts";
import { getDropChance, getMaxDurability, maxDropChance } from "./calculateArmorScore.mts";
import { logger } from "../../src/logger.mts";
import { precision } from "../../src/precision.mts";
import { waitFor } from "../../src/wait-for.mts";

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

function* getCoreItemGeneratorPrototypeForEdit(
  struct: ItemGeneratorPrototype,
  papaIndex?: string | number,
): Generator<[string, ItemGeneratorPrototypeItemGeneratorItem], void, unknown> {
  for (const [_, ig] of struct.ItemGenerator.entries()) {
    switch (ig.Category) {
      case "EItemGenerationCategory::SubItemGenerator": {
        for (const [_2, pi] of ig.PossibleItems.entries()) {
          if (allDefaultItemGeneratorsRecord[pi.ItemGeneratorPrototypeSID]) {
            yield* getCoreItemGeneratorPrototypeForEdit(allDefaultItemGeneratorsRecord[pi.ItemGeneratorPrototypeSID], papaIndex ?? _);
          }
        }
        break;
      }
      case "EItemGenerationCategory::BodyArmor":
      case "EItemGenerationCategory::Head":
        yield [papaIndex ?? _, ig] as [string, ItemGeneratorPrototypeItemGeneratorItem];
        break;
    }
  }
}
let once = false;
const armorData = await getGdocsArmorData();
const referenceMap = { ...allDefaultArmorPrototypesRecord, ...armorData.overrides };
type NewItemGeneratorsByPurpose = Record<
  "helmets" | "armors" | "allHelmets" | "allHeadedArmors" | "allHeadlessArmors" | "combos",
  Record<string, ItemGeneratorPrototype>
>;
const armorSIDSubItemGenInjectedPerFactionPerRankMap = {} as Record<ERank, Record<CoreFaction, NewItemGeneratorsByPurpose>>;

function getRelevantItemGen(relevantItems: Record<string, ItemGeneratorPrototype>, faction: string, rank: string, sidSuffix: string) {
  const subItemGen = new Struct() as ItemGeneratorPrototype;
  subItemGen.SID = `SubItemGen_for_${faction}_${rank.split("::").pop()}${sidSuffix}`;
  subItemGen.__internal__.rawName = subItemGen.SID;
  subItemGen.__internal__.isRoot = true;
  subItemGen.ItemGenerator = new Struct() as ItemGeneratorPrototypeItemGenerator;
  const igItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
  igItem.Category = "EItemGenerationCategory::SubItemGenerator";
  igItem.bAllowSameCategoryGeneration = true;
  igItem.PossibleItems = new Struct() as ItemGeneratorPrototypePossibleItems;
  for (const SID in relevantItems) {
    const ig = relevantItems[SID];
    const item = referenceMap[SID];
    const possibleItem = new Struct() as ItemGeneratorPrototypePossibleItemsItem;
    possibleItem.ItemGeneratorPrototypeSID = ig.SID;
    possibleItem.Weight = 1000 * precision(getDropChance(item) / maxDropChance);
    igItem.PossibleItems.addNode(possibleItem);
  }
  subItemGen.ItemGenerator.addNode(igItem);

  return subItemGen;
}

function doOnce(extraStructs: any[]) {
  Object.keys({ ...armorRanksBySID, ...helmetRanksBySID, ...armorData.overrides }).map((SID) => {
    /**
     * for each armor or armor+helmet combo we need to create subitemgenerator
     * where each subgenerator has 2 versions of armor: equipped and droppable
     */

    const subItemGen = new Struct() as ItemGeneratorPrototype;
    subItemGen.SID = `SubItemGen_for_${SID}`;
    subItemGen.__internal__.rawName = subItemGen.SID;
    subItemGen.__internal__.isRoot = true;
    subItemGen.ItemGenerator = new Struct() as ItemGeneratorPrototypeItemGenerator;

    /**
     *   [0] : struct.begin
     *          Category = EItemGenerationCategory::SubItemGenerator
     *          PossibleItems : struct.begin
     *             [0] : struct.begin
     *                ItemGeneratorPrototypeSID = AllAmmosNPCGenerator
     *                Chance = 1.0
     *             struct.end
     *          struct.end
     *       struct.end
     *
     * [75] : struct.begin
     *    SID = AllAmmosNPCGenerator
     *    ItemGenerator : struct.begin
     *       [0] : struct.begin
     *          Category = EItemGenerationCategory::Ammo
     *          bAllowSameCategoryGeneration = true
     *          PossibleItems : struct.begin
     *             [0] : struct.begin
     *                ItemPrototypeSID = A918D
     *                Weight = 100.0
     *                MinCount = 15
     *                MaxCount = 30
     *                bRequireWeapon = True
     *             struct.end
     */
    const armor = createArmorPrototype(SID, referenceMap);
    referenceMap[SID] = armor;

    ["EItemGenerationCategory::BodyArmor", "EItemGenerationCategory::Junk"].forEach((category, i) => {
      const subItemGenItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
      subItemGenItem.Category = category as EItemGenerationCategory;
      subItemGenItem.bAllowSameCategoryGeneration = true;
      subItemGenItem.PossibleItems = new Struct() as ItemGeneratorPrototypePossibleItems;

      const item = new Struct() as ItemGeneratorPrototypePossibleItemsItem;
      item.ItemPrototypeSID = SID;
      if (i === 0) {
        item.Chance = 1; // equipped
      } else {
        item.Chance = getDropChance(armor);
        item.MinDurability = 0;
        item.MaxDurability = getMaxDurability(armor);
      }
      subItemGenItem.PossibleItems.addNode(item);
      subItemGen.ItemGenerator.addNode(subItemGenItem);
    });

    extraStructs.push(subItemGen);

    // fill out caches
    const subItemGenFaction = armorFactionsBySID[SID] || helmetFactionsBySID[SID] || armorData.descriptors[SID].Faction;
    const subItemGenRanks = (armorRanksBySID[SID] || helmetRanksBySID[SID] || armorData.descriptors[SID].Rank).split(", ") as ERank[];

    subItemGenRanks.forEach((rank) => {
      armorSIDSubItemGenInjectedPerFactionPerRankMap[rank] ||= {} as Record<CoreFaction, NewItemGeneratorsByPurpose>;
      armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction] ||= {
        helmets: {},
        armors: {},
        combos: {},
        allHelmets: {},
        allHeadedArmors: {},
        allHeadlessArmors: {},
      } satisfies NewItemGeneratorsByPurpose;

      if (SID.toLowerCase().includes("helmet")) {
        armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction].helmets[SID] = subItemGen;
      } else {
        armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction].armors[SID] = subItemGen;
      }
    });
  });

  // create a combo sub item generator for armor + helmet OR just armor
  // create a combo sub item generator for faction ranks so it’s easier to plug them into existing structs.
  for (const rank in armorSIDSubItemGenInjectedPerFactionPerRankMap) {
    const perFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[rank as ERank];
    for (const faction in perFaction) {
      const relevantHelmets = perFaction[faction as CoreFaction].helmets;
      const relevantHelmetsSize = Object.keys(relevantHelmets).length;

      // create combo helmets
      if (relevantHelmetsSize) {
        const subItemGen = getRelevantItemGen(relevantHelmets, faction, rank, "_helmets");
        extraStructs.push(subItemGen);
        perFaction[faction as CoreFaction].allHelmets[subItemGen.SID] = subItemGen;
      }

      const relevantHeadedArmors = Object.fromEntries(
        Object.entries(perFaction[faction as CoreFaction].armors).filter(([armorSID]) => {
          return !!referenceMap[armorSID].bBlockHead;
        }),
      );
      const relevantArmorsSize = Object.keys(relevantHeadedArmors).length;

      // create combo armors
      if (relevantArmorsSize) {
        const subItemGen = getRelevantItemGen(relevantHeadedArmors, faction, rank, "_headed_armors");
        extraStructs.push(subItemGen);
        perFaction[faction as CoreFaction].allHeadedArmors[subItemGen.SID] = subItemGen;
      }

      const relevantHeadlessArmors = Object.fromEntries(
        Object.entries(perFaction[faction as CoreFaction].armors).filter(([armorSID]) => {
          return !referenceMap[armorSID].bBlockHead;
        }),
      );
      const relevantHeadlessArmorsSize = Object.keys(relevantHeadlessArmors).length;

      // create combo headless armors
      if (relevantHeadlessArmorsSize) {
        const subItemGen = getRelevantItemGen(relevantHeadlessArmors, faction, rank, "_headless_armors");
        extraStructs.push(subItemGen);
        perFaction[faction as CoreFaction].allHeadlessArmors[subItemGen.SID] = subItemGen;
      }

      // create armor helmet combos
      if (relevantHelmetsSize + relevantArmorsSize + relevantHeadlessArmorsSize) {
        const relevantAllHeadlessArmors = perFaction[faction as CoreFaction].allHeadlessArmors;
        const allHeadlessArmorsIG = Object.values(relevantAllHeadlessArmors).pop();
        const relevantAllHeadlessArmorsLenght = Object.keys(relevantAllHeadlessArmors).length;

        if (relevantAllHeadlessArmorsLenght > 1) {
          throw new Error(`Got more relevantAllHeadlessArmors than expected ${Object.keys(relevantAllHeadlessArmors)}`);
        }

        const relevantAllHelmets = perFaction[faction as CoreFaction].allHelmets;
        const allHelmetsIG = Object.values(relevantAllHelmets).pop();
        const relevantAllHelmetsArmorsLength = Object.keys(relevantAllHelmets).length;

        if (relevantAllHelmetsArmorsLength > 1) {
          throw new Error(`Got more relevantAllHelmetsArmorsLength than expected ${Object.keys(relevantAllHelmets)}`);
        }

        const comboSubItemGen = new Struct() as ItemGeneratorPrototype;
        comboSubItemGen.SID = `SubItemGen_for_${faction}_${rank.split("::").pop()}_combo`;
        comboSubItemGen.__internal__.rawName = comboSubItemGen.SID;
        comboSubItemGen.__internal__.isRoot = true;
        comboSubItemGen.ItemGenerator = new Struct() as ItemGeneratorPrototypeItemGenerator;
        const igItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
        igItem.Category = "EItemGenerationCategory::SubItemGenerator";
        igItem.bAllowSameCategoryGeneration = true;
        igItem.PossibleItems = new Struct() as ItemGeneratorPrototypePossibleItems;

        if (allHeadlessArmorsIG) {
          const allHeadlessArmorsPossibleItem = new Struct() as ItemGeneratorPrototypePossibleItemsItem;
          allHeadlessArmorsPossibleItem.ItemGeneratorPrototypeSID = allHeadlessArmorsIG.SID;
          allHeadlessArmorsPossibleItem.Chance = 1;
          igItem.PossibleItems.addNode(allHeadlessArmorsPossibleItem);
        }
        if (allHelmetsIG) {
          const allHelmetsPossibleItem = new Struct() as ItemGeneratorPrototypePossibleItemsItem;
          allHelmetsPossibleItem.ItemGeneratorPrototypeSID = allHelmetsIG.SID;
          allHelmetsPossibleItem.Chance = 1;
          igItem.PossibleItems.addNode(allHelmetsPossibleItem);
        }

        comboSubItemGen.ItemGenerator.addNode(igItem);
        perFaction[faction as CoreFaction].combos[comboSubItemGen.SID] = comboSubItemGen;
        extraStructs.push(comboSubItemGen);
      }
    }
  }
}

/**
 * Removes existing armor/helmet generation buckets and injects armor sub-item selectors by faction+rank.
 */
export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = async (struct, { filePath }) => {
  if (!shouldProcessStruct(struct)) {
    return;
  }
  const igFaction = getFactionFromItemGeneratorSID(struct.SID);

  if (!igFaction) {
    logger.warn(`Can't guess faction, ${struct.SID}`);
    return;
  }
  const extraStructs = [];
  const fork = struct.fork();
  fork.ItemGenerator = new Struct().fork() as any;
  resetCss(struct, fork);

  if (!once && filePath.endsWith("/ItemGeneratorPrototypes.cfg")) {
    once = true;
    doOnce(extraStructs);
  }
  await waitFor(() => once);
  for (const rank of ALL_RANKS_ARR) {
    const perFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[rank as ERank];
    if (!perFaction || !perFaction[igFaction]) {
      logger.warn(`No armors to drop for igFaction '${igFaction}'`);
      return;
    }

    // either combo or headed armor! bingo!
    const relevantCombos = { ...perFaction[igFaction].combos, ...perFaction[igFaction].allHeadedArmors };
    const relevantCombosLenght = Object.keys(relevantCombos).length;

    if (relevantCombosLenght) {
      const igItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
      igItem.Category = "EItemGenerationCategory::SubItemGenerator";
      igItem.PlayerRank = rank;
      igItem.bAllowSameCategoryGeneration = true;
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
  return extraStructs;
};

/**
 * Removes any existing item generators
 */
function resetCss(struct: ItemGeneratorPrototype, fork: ItemGeneratorPrototype) {
  getCoreItemGeneratorPrototypeForEdit(struct).forEach(([key, ig]) => {
    const igFork = ig.fork();
    igFork.bAllowSameCategoryGeneration = true;
    igFork.PossibleItems = new Struct() as any;
    igFork.removeNode("PossibleItems");
    fork.ItemGenerator.addNode(igFork, key);
  });
}

transformItemGenerators.files = ["/DynamicItemGenerator.cfg", "/QuestItemGeneratorPrototypes.cfg", "/ItemGeneratorPrototypes.cfg"];
