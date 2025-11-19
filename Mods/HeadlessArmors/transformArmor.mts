import { DynamicItemGenerator, ERank, GetStructType, Struct } from "s2cfgtojson";
import { factions } from "./factions.mjs";
import { extraArmorsByFaction, newArmors } from "./armors.util.mjs";
import { PossibleItem } from "./possibleItem.mjs";

import { undroppableArmors } from "./undroppableArmors.mjs";
import { precision } from "./precision.mjs";
import { allArmorRank } from "./allArmorRank.mjs";
import { semiRandom } from "../../src/semi-random.mjs";
import { allRanks } from "./addMissingCategories.mjs";

/**
 * Allows NPCs to drop armor and helmets.
 */
export const transformArmor = (
  struct: DynamicItemGenerator,
  itemGenerator: DynamicItemGenerator["ItemGenerator"][`${number}`],
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
  fork.PlayerRank = itemGenerator.PlayerRank;
  fork.Category = itemGenerator.Category;
  if (!itemGenerator.PossibleItems) {
    return;
  }
  fork.PossibleItems = itemGenerator.PossibleItems.filter(
    (e): e is any => !!(e[1] && allArmorRank[e[1].ItemPrototypeSID]),
  );
  const options = fork.PossibleItems.entries().map(([_k, v]) => v);

  const weights = Object.fromEntries(
    options.map((pi) => {
      const key = pi.ItemPrototypeSID;
      return [key, getChanceForSID(key)];
    }),
  );
  const droppableArmors = options.filter((pi) => !undroppableArmors.has(pi.ItemPrototypeSID));
  const invisibleArmors = options.filter((pi) => undroppableArmors.has(pi.ItemPrototypeSID));
  const faction = struct.SID.split("_").find((f) => factions[f.toLowerCase()]) || "neutral";
  const extraArmors = extraArmorsByFaction[factions[faction.toLowerCase()] as keyof typeof extraArmorsByFaction];

  extraArmors
    .filter((descriptor) => {
      const highestRank = descriptor.__internal__._extras?.ItemGenerator?.PlayerRank?.split(",")
        .map((e) => allRanks.indexOf(e.trim() as ERank))
        .sort()
        .pop();
      const igRank = allRanks.indexOf(fork.PlayerRank as ERank);
      return highestRank && igRank ? igRank >= highestRank : true;
    })
    .forEach((descriptor) => {
      const originalSID = descriptor.__internal__.refkey;
      const newArmorSID = descriptor.SID as string;
      const dummyPossibleItem = new Struct({
        ItemPrototypeSID: newArmorSID,
        __internal__: { rawName: "_" },
      }) as GetStructType<PossibleItem>;

      weights[newArmorSID] = getChanceForSID(allArmorRank[newArmorSID] ? newArmorSID : originalSID);
      const maybeNewArmor = newArmors[newArmorSID] as typeof descriptor;

      if (
        fork.Category ===
        (maybeNewArmor?.__internal__._extras?.ItemGenerator?.Category || "EItemGenerationCategory::BodyArmor")
      ) {
        fork.PossibleItems.addNode(dummyPossibleItem, newArmorSID);
        if (maybeNewArmor || descriptor.__internal__._extras.isDroppable) {
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
  fork.PossibleItems = fork.PossibleItems.filter((e): e is any => !!(e[1] && allArmorRank[e[1].ItemPrototypeSID]));
  if (!fork.PossibleItems.entries().length) {
    return;
  }

  return fork;
};

function getChanceForSID(sid: string) {
  const zeroToOne = 1 - (allArmorRank[sid] - minimumArmorCost) / (maximumArmorCost - minimumArmorCost); // 1 means cheapest armor, 0 means most expensive armor
  return zeroToOne * 0.14 + 0.01; // 1% to 15%
}
const minimumArmorCost = Object.values(allArmorRank).reduce((a, b) => Math.min(a, b), Infinity);
const maximumArmorCost = Object.values(allArmorRank).reduce((a, b) => Math.max(a, b), -Infinity);
const minDropDurability = 0.01; // 1%
const maxDropDurability = 0.5; // 50%
