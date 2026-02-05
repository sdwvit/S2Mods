import {
  ALL_RANKS_ARR,
  allDefaultArmorPrototypes,
  allDefaultArmorPrototypesRecord,
  allDefaultDroppableArmorsByFaction,
  allDefaultNightVisionGogglesPrototypes,
  allDefaultNightVisionGogglesPrototypesRecord,
  ArmorDescriptor,
  CoreFaction,
  Factions,
  getCorePrototype,
  getFactionFromItemGeneratorSID,
} from "../../src/consts.mts";

import { extraArmorsByFaction, newArmors } from "./armors.util.mts";
import { allItemRank } from "./all-item-rank.mts";
import { ItemGeneratorPrototype, ERank, GetStructType, Struct, ItemGeneratorPrototypeItemGeneratorItem, Refs } from "s2cfgtojson";
import { precision } from "../../src/precision.mts";
import { semiRandom } from "../../src/semi-random.mts";
import { markAsForkRecursively } from "../../src/mark-as-fork-recursively.mts";
import { logger } from "../../src/logger.mts";

const minimumArmorCost = Object.values(allItemRank).reduce((a, b) => Math.min(a, b), Infinity);
const maximumArmorCost = Object.values(allItemRank).reduce((a, b) => Math.max(a, b), -Infinity);
const allDefaultNPCArmorPrototypeSIDs = allDefaultArmorPrototypes.map((e) => e?.SID).filter((s) => s.includes("NPC_"));
const undroppableArmors = new Set(allDefaultNPCArmorPrototypeSIDs);

const minDropDurability = 0.01; // 1%
const maxDropDurability = 0.5; // 50%

function getChanceForSID(sid: string) {
  const zeroToOne = 1 - (allItemRank[sid] - minimumArmorCost) / (maximumArmorCost - minimumArmorCost); // 1 means cheapest armor, 0 means most expensive armor
  return zeroToOne * 0.05 + 0.01; // 1% to 5%
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
const nvgsDescriptors: { __internal__: Refs; SID: string }[] = nvgs.map((e) => {
  return {
    __internal__: e.__internal__,
    SID: e.SID,
  };
});
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

/**
 * Allows NPCs to drop armor and helmets.
 */
export const adjustArmorItemGenerator = (fork: ItemGeneratorPrototype, structSID: string) => {
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

  const forkIG = fork.ItemGenerator;

  const faction = getFactionFromItemGeneratorSID(SID) || getFactionFromItemGeneratorSID(structSID);
  if (!faction) {
    logger.warn(`${SID}${SID !== structSID ? `/${structSID}` : ''} has no proper faction: '${faction}'`);
    return;
  }

  forkIG.forEach(([forkIGKey, forkIG], i) => {
    forkIG.bAllowSameCategoryGeneration = true;
    if (!forkIG.Category) {
      return;
    }

    const weights = {};
    const droppableArmors = [];
    const invisibleArmors = [];

    const defaultArmors = allDefaultDroppableArmorsByFaction[faction];
    const extraArmors = extraArmorsByFaction[faction];
    const nvgsForFaction = nvgsByFaction[faction] || [];

    [...defaultArmors, ...extraArmors, ...nvgsForFaction]
      .filter((descriptor: ArmorDescriptor): descriptor is ArmorDescriptor => {
        const lowestItemRank = descriptor.__internal__._extras?.ItemGenerator?.PlayerRank?.split(",")
          .map((e) => ALL_RANKS_ARR.indexOf(e.trim() as ERank))
          .sort()[0];
        const lowestIGRank = forkIG.PlayerRank.split(",")
          .map((e) => ALL_RANKS_ARR.indexOf(e.trim() as ERank))
          .sort()[0];
        return Number.isInteger(lowestItemRank) && Number.isInteger(lowestIGRank) ? lowestIGRank >= lowestItemRank : true;
      })
      .forEach((descriptor) => {
        const originalSID = (getCorePrototype(descriptor) || newArmors[descriptor.__internal__.refkey])?.SID;
        if (!originalSID) {
          logger.warn(`Can't find original SID: '${descriptor.SID}', '${descriptor.__internal__.refkey}'`);
          return;
        }
        const newItemSID = descriptor.SID as string;
        const dummyPossibleItem = new Struct({
          ItemPrototypeSID: newItemSID,
          __internal__: { rawName: "_" },
        }) as GetStructType<PossibleItem>;

        weights[newItemSID] = getChanceForSID(allItemRank[newItemSID] ? newItemSID : originalSID);
        const maybeNewArmor = newArmors[newItemSID] as typeof descriptor;

        if (forkIG.Category === (maybeNewArmor?.__internal__._extras?.ItemGenerator?.Category || "EItemGenerationCategory::BodyArmor")) {
          forkIG.PossibleItems.addNode(dummyPossibleItem, newItemSID);
          if (
            maybeNewArmor ||
            descriptor.__internal__._extras.isDroppable ||
            (allDefaultArmorPrototypesRecord[newItemSID] && !undroppableArmors.has(newItemSID))
          ) {
            droppableArmors.push(dummyPossibleItem as any);
          } else {
            invisibleArmors.push(dummyPossibleItem as any);
          }
        }
      });
    const maxAB = Math.max(0, ...droppableArmors.map((pi) => weights[pi.ItemPrototypeSID]));

    const abSum = droppableArmors.reduce((acc, pi) => acc + weights[pi.ItemPrototypeSID], 0);
    const cdSum = invisibleArmors.reduce((acc, pi) => acc + weights[pi.ItemPrototypeSID], 0);

    const x = cdSum ? abSum / maxAB : abSum;
    const y = cdSum / (1 - maxAB);
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
    // forkIG.PossibleItems = forkIG.PossibleItems.filter((e): e is any => !!(e[1] && allItemRank[e[1].ItemPrototypeSID]));
    if (!forkIG.PossibleItems.entries().length) {
      return;
    }

    return forkIG;
  });
};
