import {
  ALL_RANKS_ARR,
  ALL_RANKS_SET,
  allDefaultArmorPrototypes,
  allDefaultArmorPrototypesRecord,
  allDefaultDroppableArmorsByFaction,
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultNightVisionGogglesPrototypes,
  allDefaultNightVisionGogglesPrototypesRecord,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
  ArmorDescriptor,
  CoreFaction,
  Factions,
  getArmorNVGCorePrototype,
  getFactionFromItemGeneratorSID,
} from "../../src/consts.mts";

import { getAllItemRank } from "./all-item-rank.mts";
import { EItemGenerationCategory, ERank, GetStructType, ItemGeneratorPrototype, Refs, Struct } from "s2cfgtojson";
import { precision } from "../../src/precision.mts";
import { semiRandom } from "../../src/semi-random.mts";
import { logger } from "../../src/logger.mts";
import { getGdocsArmorData } from "./gdocs-armors.mts";

const allDefaultNPCArmorPrototypeSIDs = allDefaultArmorPrototypes.map((e) => e?.SID).filter((s) => s.includes("NPC_"));
const undroppableArmors = new Set(allDefaultNPCArmorPrototypeSIDs);

const minDropDurability = 0.01; // 1%
const maxDropDurability = 0.5; // 50%
// 1% to 5%
const minDropChance = 0.01;
const maxDropChance = 0.05;
let itemRank: Record<string, number> = {};
let minimumArmorCost = Infinity;
let maximumArmorCost = -Infinity;
let sheetArmorsByFactionPromise: Promise<Record<CoreFaction, ArmorDescriptor[]>> | null = null;

const explicitFactionByRefkey: Record<string, CoreFaction> = {
  NPC_Sel_Neutral_Armor: "Neutrals",
  NPC_Cloak_Heavy_Neutral_Armor: "Neutrals",
  NPC_HeavyExoskeleton_Mercenaries_Armor: "Mercenaries",
  NPC_Heavy_Military_Armor: "Militaries",
  NPC_Cloak_Heavy_Military_Armor: "Militaries",
  NPC_Heavy_Corps_Armor: "Corpus",
  NPC_Heavy3_Corps_Armor: "Corpus",
  NPC_Heavy2_Coprs_Armor: "Corpus",
  NPC_Heavy3Exoskeleton_Coprs_Armor: "Corpus",
  NPC_Exoskeleton_Coprs_Armor: "Corpus",
  Battle_Dolg_End_Armor: "Corpus",
  NPC_Sci_Armor: "Scientists",
  NPC_Battle_Noon_Armor: "Monolith",
  NPC_HeavyAnomaly_Noon_Armor: "Monolith",
  NPC_HeavyExoskeleton_Noon_Armor: "Monolith",
  NPC_Exoskeleton_Noon_Armor: "Monolith",
  NPC_HeavyExoskeleton_Spark_Armor: "Spark",
  NPC_Spark_Armor: "Spark",
  NPC_Anomaly_Spark_Armor: "Spark",
};

function getChanceForSID(sid: string) {
  const base = itemRank[sid];
  if (!base || !Number.isFinite(minimumArmorCost) || !Number.isFinite(maximumArmorCost) || maximumArmorCost === minimumArmorCost) {
    return 0.02;
  }
  // 1 means cheapest armor, 0 means most expensive armor
  return 1 - (base - minimumArmorCost) / (maximumArmorCost - minimumArmorCost); // 0..1
}

type PossibleItem = {
  ItemGeneratorPrototypeSID?: string;
  ItemPrototypeSID: string;
  Weight: number;
  MinDurability: number;
  MaxDurability: number;
  Chance: number;
  AmmoMinCount?: number;
  AmmoMaxCount?: number;
};

export const nvgs = allDefaultNightVisionGogglesPrototypes
  .filter((e) => e.SID !== "TemplateNightVisionGoggles" && !e.SID.includes("NPC"))
  .map((e, i, arr) => {
    const rank = ALL_RANKS_ARR[Math.round((ALL_RANKS_ARR.length * i) / arr.length)];
    (e as ArmorDescriptor).__internal__._extras = {
      isDroppable: true,
      ItemGenerator: { PlayerRank: rank, Category: "EItemGenerationCategory::BodyArmor" },
    };
    return e;
  });

const nvgsDescriptors: { __internal__: Refs; SID: string }[] = nvgs.map((e) => ({ __internal__: e.__internal__, SID: e.SID }));

const nvgsByFaction: Record<CoreFaction, typeof nvgsDescriptors> = {
  FreeStalkers: nvgsDescriptors.slice(0, 3),
  Mutant: [],
  Noon: nvgsDescriptors.slice(0, 4),
  Neutrals: nvgsDescriptors.slice(0, 3),
  Bandits: nvgsDescriptors.slice(0, 2),
  Mercenaries: nvgsDescriptors.slice(0, 4),
  Militaries: nvgsDescriptors.slice(0, 3),
  Corpus: nvgsDescriptors.slice(0, 4),
  Scientists: nvgsDescriptors.slice(0, 3),
  Freedom: nvgsDescriptors.slice(0, 4),
  Duty: nvgsDescriptors.slice(0, 3),
  Monolith: nvgsDescriptors.slice(0, 4),
  Varta: nvgsDescriptors.slice(0, 3),
  Spark: nvgsDescriptors.slice(0, 4),
};

function isHelmetLikeSID(sidOrRef: string | undefined) {
  return !!sidOrRef?.toLowerCase().includes("helmet");
}

function getItemGeneratorCategory(descriptor: ArmorDescriptor): EItemGenerationCategory {
  if (isHelmetLikeSID(descriptor.SID) || isHelmetLikeSID(descriptor.__internal__?.refkey?.toString())) {
    return "EItemGenerationCategory::Head";
  }
  return (descriptor.__internal__?._extras?.ItemGenerator?.Category || "EItemGenerationCategory::BodyArmor") as EItemGenerationCategory;
}

function isFullRankPlayerRank(playerRank: string | undefined) {
  if (!playerRank) {
    return false;
  }
  const ranks = new Set(
    playerRank
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
  );
  if (ranks.size !== ALL_RANKS_SET.size) {
    return false;
  }
  return [...ALL_RANKS_SET].every((rank) => ranks.has(rank));
}

function getRanksFromPlayerRank(playerRank: string | undefined): ERank[] {
  if (!playerRank) {
    return [];
  }
  return playerRank
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is ERank => ALL_RANKS_SET.has(r as ERank));
}

function getLowestRankIndex(playerRank: string | undefined) {
  const ranks = getRanksFromPlayerRank(playerRank);
  if (!ranks.length) {
    return -1;
  }
  return Math.min(...ranks.map((r) => ALL_RANKS_ARR.indexOf(r)).filter((i) => i >= 0));
}

function ensureMissingArmorCategoriesWithCandidates(itemGenerators: ItemGeneratorPrototype["ItemGenerator"], descriptors: ArmorDescriptor[]) {
  const existingCategoryRankKeys = new Set<string>();
  itemGenerators.forEach(([_, ig]) => {
    if (!ig.Category) {
      return;
    }
    if (isFullRankPlayerRank(ig.PlayerRank)) {
      // Full-rank buckets are intentionally skipped for injection; do not treat them as covering all ranks.
      return;
    }
    const ranks = getRanksFromPlayerRank(ig.PlayerRank);
    ranks.forEach((rank) => {
      existingCategoryRankKeys.add(`${ig.Category}|${rank}`);
    });
  });

  const categories: EItemGenerationCategory[] = ["EItemGenerationCategory::Head", "EItemGenerationCategory::BodyArmor"];
  categories.forEach((category) => {
    ALL_RANKS_ARR.forEach((rank) => {
      const key = `${category}|${rank}`;
      if (existingCategoryRankKeys.has(key)) {
        return;
      }

      const rankIndex = ALL_RANKS_ARR.indexOf(rank);
      const hasEligibleDescriptor = descriptors.some((descriptor) => {
        if (getItemGeneratorCategory(descriptor) !== category) {
          return false;
        }
        const lowestItemRank = getLowestRankIndex(descriptor.__internal__._extras?.ItemGenerator?.PlayerRank);
        return lowestItemRank >= 0 ? rankIndex >= lowestItemRank : true;
      });
      if (!hasEligibleDescriptor) {
        return;
      }

      itemGenerators.addNode(
        new Struct({
          Category: category,
          PlayerRank: rank,
          bAllowSameCategoryGeneration: true,
          PossibleItems: {},
        }),
        `${category.replace("EItemGenerationCategory::", "")}_for_${rank.replace("ERank::", "")}`,
      );
    });
  });
}

/**
 * Allows NPCs to drop armor and helmets.
 */
export const adjustArmorItemGenerator = async (fork: ItemGeneratorPrototype, structSID: string) => {
  const [extraArmorsByFaction, ranks] = await Promise.all([getSheetArmorsByFaction(), getAllItemRank()]);
  itemRank = ranks;
  minimumArmorCost = Object.values(itemRank).reduce((a, b) => Math.min(a, b), Infinity);
  maximumArmorCost = Object.values(itemRank).reduce((a, b) => Math.max(a, b), -Infinity);

  const SID = fork.__internal__.rawName;
  if (
    SID.includes("WeaponPistol") ||
    SID.includes("Consumables") ||
    SID.includes("Attachments") ||
    SID.includes("No_Armor") ||
    SID.includes("DeadBody")
  ) {
    return;
  }

  const canInjectNewItems =
    !!allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[structSID] ||
    !!allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[structSID];
  if (!canInjectNewItems) {
    // Armor-drop removals are handled in transformDynamicItemGenerator before this function is called.
    return;
  }

  const forkIG = fork.ItemGenerator;
  const faction = getFactionFromItemGeneratorSID(SID) || getFactionFromItemGeneratorSID(structSID);
  if (!faction) {
    logger.debug(`${SID}${SID !== structSID ? `/${structSID}` : ""} has no proper faction: '${faction}'`);
    return;
  }

  const defaultArmors = allDefaultDroppableArmorsByFaction[faction];
  const extraArmors = extraArmorsByFaction[faction] || [];
  const nvgsForFaction = nvgsByFaction[faction] || [];
  const allFactionDescriptors = [...defaultArmors, ...extraArmors, ...nvgsForFaction];
  ensureMissingArmorCategoriesWithCandidates(forkIG, allFactionDescriptors);

  forkIG.forEach(([_, itemGen], i) => {
    itemGen.bAllowSameCategoryGeneration = true;
    if (!itemGen.Category) {
      return;
    }
    if (isFullRankPlayerRank(itemGen.PlayerRank)) {
      return;
    }

    const weights: Record<string, number> = {};
    const droppableArmors: GetStructType<PossibleItem>[] = [];
    const invisibleArmors: GetStructType<PossibleItem>[] = [];

    allFactionDescriptors
      .filter((descriptor: ArmorDescriptor): descriptor is ArmorDescriptor => {
        const lowestItemRank = getLowestRankIndex(descriptor.__internal__._extras?.ItemGenerator?.PlayerRank);
        const lowestIGRank = getLowestRankIndex(itemGen.PlayerRank);
        return Number.isInteger(lowestItemRank) && Number.isInteger(lowestIGRank) ? lowestIGRank >= lowestItemRank : true;
      })
      .forEach((descriptor) => {
        const originalSID = getArmorNVGCorePrototype(descriptor)?.SID || descriptor.__internal__.refkey.toString();
        if (!originalSID) {
          logger.warn(`Can't find original SID: '${descriptor.SID}', '${descriptor.__internal__.refkey}'`);
          return;
        }

        const newItemSID = descriptor.SID as string;
        const dummyPossibleItem = new Struct({ ItemPrototypeSID: newItemSID, __internal__: { rawName: "_" } }) as GetStructType<PossibleItem>;

        weights[newItemSID] = getChanceForSID(itemRank[newItemSID] ? newItemSID : originalSID) * maxDropChance + minDropChance;

        if (itemGen.Category === getItemGeneratorCategory(descriptor)) {
          itemGen.PossibleItems.addNode(dummyPossibleItem, newItemSID);

          if (descriptor.__internal__._extras?.isDroppable || (allDefaultArmorPrototypesRecord[newItemSID] && !undroppableArmors.has(newItemSID))) {
            droppableArmors.push(dummyPossibleItem as any);
          } else {
            invisibleArmors.push(dummyPossibleItem as any);
          }
        }
      });

    const maxAB = Math.max(0, ...droppableArmors.map((pi) => weights[pi.ItemPrototypeSID]));
    const abSum = droppableArmors.reduce((acc, pi) => acc + weights[pi.ItemPrototypeSID], 0);
    const cdSum = invisibleArmors.reduce((acc, pi) => acc + weights[pi.ItemPrototypeSID], 0);

    const x = cdSum ? abSum / (maxAB || 1) : abSum || 1;
    const y = cdSum ? cdSum / (1 - maxAB || 1) : 1;

    droppableArmors.forEach((pi) => {
      pi.Chance = precision(weights[pi.ItemPrototypeSID]);
      if (allDefaultNightVisionGogglesPrototypesRecord[pi.ItemPrototypeSID]) {
        pi.Weight = precision(weights[pi.ItemPrototypeSID]);
      } else {
        pi.Weight = precision(weights[pi.ItemPrototypeSID] / x);
        pi.MinDurability = precision(semiRandom(i) * 0.1 + minDropDurability);
        pi.MaxDurability = precision(pi.MinDurability + semiRandom(i) * maxDropDurability);
      }
    });

    invisibleArmors.forEach((pi) => {
      pi.Chance = 1; // make sure it always spawns on npc
      pi.Weight = precision(weights[pi.ItemPrototypeSID] / y);
      // i know this is not needed, but sometimes game decides to ignore the fact these are invisible
      pi.MinDurability = precision(semiRandom(i) * 0.1 + minDropDurability);
      pi.MaxDurability = precision(pi.MinDurability + semiRandom(i) * maxDropDurability);
    });

    if (!itemGen.PossibleItems.entries().length) {
      return;
    }

    return itemGen;
  });

  // Remove generated category buckets that ended up empty after filtering/skips.
  forkIG.forEach(([key, itemGen]) => {
    const rawName = String(key);
    const isGeneratedArmorBucket = rawName.startsWith("Head_for_") || rawName.startsWith("BodyArmor_for_");
    if (!isGeneratedArmorBucket) {
      return;
    }
    const possibleItemsCount = itemGen.PossibleItems?.entries?.().length ?? 0;
    if (!possibleItemsCount) {
      forkIG.removeNode?.(key as any);
    }
  });
};

async function getSheetArmorsByFaction(): Promise<Record<CoreFaction, ArmorDescriptor[]>> {
  if (!sheetArmorsByFactionPromise) {
    sheetArmorsByFactionPromise = buildSheetArmorsByFaction();
  }
  return sheetArmorsByFactionPromise;
}

async function buildSheetArmorsByFaction(): Promise<Record<CoreFaction, ArmorDescriptor[]>> {
  const gdocs = await getGdocsArmorData();
  const sheetBySid: Record<string, ArmorDescriptor> = Object.fromEntries(gdocs.descriptors.map((d) => [d.SID, d]));

  const sidToFaction: Record<string, CoreFaction> = {};
  const sidToRank: Record<string, string> = {};
  Object.entries(allDefaultDroppableArmorsByFaction).forEach(([faction, defs]) => {
    defs.forEach((d) => {
      sidToFaction[d.SID] = faction as CoreFaction;
      sidToRank[d.SID] = d.__internal__?._extras?.ItemGenerator?.PlayerRank || "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master";
    });
  });

  const byFactionMap = Object.fromEntries(Object.keys(Factions).map((f) => [f, {}])) as Record<CoreFaction, Record<string, ArmorDescriptor>>;

  const resolveRootRef = (ref: string) => {
    let cur = ref;
    const seen = new Set<string>();
    while (sheetBySid[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = sheetBySid[cur].__internal__.refkey.toString();
    }
    return cur;
  };

  for (const descriptor of gdocs.descriptors) {
    const rootRef = resolveRootRef(descriptor.__internal__.refkey!.toString());
    const refKey = descriptor.__internal__.refkey!.toString();
    const faction =
      sidToFaction[rootRef] ||
      sidToFaction[refKey] ||
      explicitFactionByRefkey[rootRef] ||
      explicitFactionByRefkey[refKey] ||
      explicitFactionByRefkey[descriptor.SID] ||
      getFactionFromItemGeneratorSID(descriptor.SID);
    if (!faction) {
      continue;
    }
    const rank =
      sidToRank[rootRef] || sidToRank[descriptor.__internal__.refkey] || "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master";
    const isDroppable = !descriptor.SID.includes("_NPC");

    const item = {
      SID: descriptor.SID,
      __internal__: {
        refkey: descriptor.__internal__.refkey,
        _extras: {
          isDroppable,
          ItemGenerator: {
            PlayerRank: rank,
            Category: getItemGeneratorCategory(descriptor),
          },
        },
      },
    } as ArmorDescriptor;

    byFactionMap[faction][item.SID] = item;
  }

  return Object.fromEntries(Object.entries(byFactionMap).map(([faction, bySid]) => [faction, Object.values(bySid)])) as Record<
    CoreFaction,
    ArmorDescriptor[]
  >;
}
