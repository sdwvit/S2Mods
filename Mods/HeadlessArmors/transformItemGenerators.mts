import {
  ArmorPrototype,
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
import { getDropChance, getMaxDurability } from "./calculateArmorScore.mts";
import { logger } from "../../src/logger.mts";

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
): Generator<[string, ItemGeneratorPrototypeItemGeneratorItem], void, unknown> {
  for (const [_, ig] of struct.ItemGenerator.entries()) {
    switch (ig.Category) {
      case "EItemGenerationCategory::SubItemGenerator": {
        for (const [_2, pi] of ig.PossibleItems.entries()) {
          if (allDefaultItemGeneratorsRecord[pi.ItemGeneratorPrototypeSID]) {
            yield* getCoreItemGeneratorPrototypeForEdit(allDefaultItemGeneratorsRecord[pi.ItemGeneratorPrototypeSID]);
          }
        }
        break;
      }
      case "EItemGenerationCategory::BodyArmor":
      case "EItemGenerationCategory::Head":
        yield [_, ig] as [string, ItemGeneratorPrototypeItemGeneratorItem];
        break;
    }
  }
}
let once = false;
const armorData = await getGdocsArmorData();
const referenceMap = { ...allDefaultArmorPrototypesRecord, ...armorData.overrides };
const armorSIDSubItemGenInjectedPerFactionPerRankMap = {} as Record<
  ERank,
  Record<CoreFaction, Record<"helmets" | "armors", Record<string, ItemGeneratorPrototype>>>
>;
const armorSIDSubItemGenInjectedMap = {} as Record<string, ItemGeneratorPrototype>;

/**
 * Removes existing armor/helmet generation buckets and injects armor sub-item selectors by faction+rank.
 */
export const transformItemGenerators: StructTransformer<ItemGeneratorPrototype> = async (struct) => {
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

  if (!once) {
    once = true;

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

      ["EItemGenerationCategory::BodyArmor", "EItemGenerationCategory::Junk"].forEach((category, i) => {
        const subItemGenItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;
        subItemGenItem.Category = category as EItemGenerationCategory;
        subItemGenItem.bAllowSameCategoryGeneration = true;
        subItemGenItem.PossibleItems = new Struct() as ItemGeneratorPrototypePossibleItems;

        const item = new Struct() as ItemGeneratorPrototypePossibleItemsItem;
        item.ItemPrototypeSID = SID;
        if (!i) {
          item.Chance = 1;
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

      armorSIDSubItemGenInjectedMap[SID] = subItemGen;
      subItemGenRanks.forEach((rank) => {
        armorSIDSubItemGenInjectedPerFactionPerRankMap[rank] ||= {} as Record<
          CoreFaction,
          Record<"helmets" | "armors", Record<string, ItemGeneratorPrototype>>
        >;
        armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction] ||= {
          helmets: {},
          armors: {},
        } as Record<"helmets" | "armors", Record<string, ItemGeneratorPrototype>>;
        if (SID.toLowerCase().includes("helmet")) {
          armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction].helmets[SID] = subItemGen;
        } else {
          armorSIDSubItemGenInjectedPerFactionPerRankMap[rank][subItemGenFaction].armors[SID] = subItemGen;
        }
      });
    });
  }

  for (const rank of ALL_RANKS_ARR) {
    const perFaction = armorSIDSubItemGenInjectedPerFactionPerRankMap[rank as ERank];
    if (!perFaction || !perFaction[igFaction]) {
      logger.warn(`No armors to drop for igFaction '${igFaction}'`)
      return;
    }
    for (const genSID in perFaction[igFaction].armors) {
      const itemGenItem = new Struct() as ItemGeneratorPrototypeItemGeneratorItem;

      fork.ItemGenerator.addNode(itemGenItem, genSID);
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
