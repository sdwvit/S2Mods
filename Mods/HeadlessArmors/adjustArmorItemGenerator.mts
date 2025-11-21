import { DynamicItemGenerator, ERank, GetStructType, Struct } from "s2cfgtojson";
import { factions } from "./factions.mjs";
import { extraArmorsByFaction, newArmors } from "./armors.util.mjs";

import { precision } from "./precision.mjs";

import { markAsForkRecursively } from "./markAsForkRecursively.mjs";
import { allItemRank } from "./allItemRank.mjs";
import {
  allDefaultArmorDefs,
  allDefaultArmorPrototypes,
  allDefaultDroppableArmorsByFaction,
  allDefaultNightVisionGogglesPrototypes,
  ArmorDescriptor,
} from "../../src/consts.mjs";
import { ALL_RANKS_ARR } from "./addMissingCategories.mjs";
import { semiRandom } from "../../src/semi-random.mjs";

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
const nvgsDescriptors = nvgs.map((e) => {
  return {
    __internal__: e.__internal__,
    SID: e.SID,
  };
});
const nvgsByFaction = {
  neutral: nvgsDescriptors.slice(0, 3),
  bandit: nvgsDescriptors.slice(0, 2),
  mercenary: nvgsDescriptors.slice(0, 4),
  military: nvgsDescriptors.slice(0, 3),
  corpus: nvgsDescriptors.slice(0, 4),
  scientist: nvgsDescriptors.slice(0, 3),
  freedom: nvgsDescriptors.slice(0, 4),
  duty: nvgsDescriptors.slice(0, 3),
  monolith: nvgsDescriptors.slice(0, 4),
  varta: nvgsDescriptors.slice(0, 3),
  spark: nvgsDescriptors.slice(0, 4),
};
/**
 * Allows NPCs to drop armor and helmets.
 */
export const adjustArmorItemGenerator = (
  struct: DynamicItemGenerator,
  itemGenerator: DynamicItemGenerator["ItemGenerator"]["0"],
  i: number,
) => {
  if (
    struct.SID.includes("WeaponPistol") ||
    struct.SID.includes("Consumables") ||
    struct.SID.includes("Attachments") ||
    struct.SID.includes("Zombie") ||
    struct.SID.includes("No_Armor") ||
    struct.SID.includes("DeadBody")
  ) {
    return;
  }
  const fork = itemGenerator.fork();
  fork.bAllowSameCategoryGeneration = true;
  if (itemGenerator.PlayerRank) fork.PlayerRank = itemGenerator.PlayerRank;
  fork.Category = itemGenerator.Category;
  if (!itemGenerator.PossibleItems) {
    return;
  }
  fork.PossibleItems = itemGenerator.PossibleItems.filter(
    (e): e is any => !!(e[1] && allItemRank[e[1].ItemPrototypeSID]),
  );
  const options = fork.PossibleItems.entries().map(([_k, v]) => v);
  const optionsBySID = Object.fromEntries(options.map((pi) => [pi.ItemPrototypeSID, pi]));
  const weights = Object.fromEntries(
    options.map((pi) => {
      const key = pi.ItemPrototypeSID;
      return [key, getChanceForSID(key)];
    }),
  );
  const droppableArmors = options.filter((pi) => !undroppableArmors.has(pi.ItemPrototypeSID));
  const invisibleArmors = options.filter((pi) => undroppableArmors.has(pi.ItemPrototypeSID));
  const faction =
    factions[
      struct.SID.split("_")
        .find((f) => factions[f.toLowerCase()])
        ?.toLowerCase() || "neutral"
    ];
  const defaultArmors = allDefaultDroppableArmorsByFaction[faction];
  const extraArmors = extraArmorsByFaction[faction];
  const nvgsForFaction = nvgsByFaction[faction] || [];

  [...defaultArmors, ...extraArmors, ...nvgsForFaction]
    .filter((descriptor: ArmorDescriptor): descriptor is ArmorDescriptor => {
      if (optionsBySID[descriptor.SID]) {
        return false; // already exists
      }
      const lowestRank = descriptor.__internal__._extras?.ItemGenerator?.PlayerRank?.split(",")
        .map((e) => ALL_RANKS_ARR.indexOf(e.trim() as ERank))
        .sort()[0];
      const igRank = ALL_RANKS_ARR.indexOf(fork.PlayerRank as ERank);
      return Number.isInteger(lowestRank) && Number.isInteger(igRank) ? igRank >= lowestRank : true;
    })
    .forEach((descriptor) => {
      const originalSID = descriptor.__internal__.refkey.toString();
      const newItemSID = descriptor.SID as string;
      const dummyPossibleItem = new Struct({
        ItemPrototypeSID: newItemSID,
        __internal__: { rawName: "_" },
      }) as GetStructType<PossibleItem>;

      weights[newItemSID] = getChanceForSID(allItemRank[newItemSID] ? newItemSID : originalSID);
      const maybeNewArmor = newArmors[newItemSID] as typeof descriptor;

      if (
        fork.Category ===
        (maybeNewArmor?.__internal__._extras?.ItemGenerator?.Category || "EItemGenerationCategory::BodyArmor")
      ) {
        fork.PossibleItems.addNode(dummyPossibleItem, newItemSID);
        if (
          maybeNewArmor ||
          descriptor.__internal__._extras.isDroppable ||
          (allDefaultArmorDefs[newItemSID] && !undroppableArmors.has(newItemSID))
        ) {
          // todo this shit doesn't drop default armors
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
    pi.Weight = precision(weights[pi.ItemPrototypeSID] / x);
    pi.MinDurability = precision(semiRandom(i) * 0.1 + minDropDurability);
    pi.MaxDurability = precision(pi.MinDurability + semiRandom(i) * maxDropDurability);
  });
  invisibleArmors.forEach((pi) => {
    pi.Chance = 1; // make sure it always spawns on npc
    pi.Weight = precision(weights[pi.ItemPrototypeSID] / y);
  });
  fork.PossibleItems = fork.PossibleItems.filter((e): e is any => !!(e[1] && allItemRank[e[1].ItemPrototypeSID]));
  if (!fork.PossibleItems.entries().length) {
    return;
  }

  return markAsForkRecursively(fork);
};
