import { ItemGeneratorPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { semiRandom } from "../../src/semi-random.mts";
import { markAsForkRecursively } from "../../src/mark-as-fork-recursively.mts";
import { allDefaultAmmoPrototypesRecord, allDefaultConsumablePrototypesRecord, allDefaultGrenadePrototypesRecord } from "../../src/consts.mts";

export const transformItemGeneratorPrototypes: StructTransformer<ItemGeneratorPrototype> = async (struct, context) => {
  if (prohibitedIds.some((id) => struct.SID.includes(id))) {
    return null;
  }
  const ItemGenerator = struct.ItemGenerator?.map(([_k, itemGen], i) => {
    const fork = itemGen.fork();
    const PossibleItems = itemGen.PossibleItems?.map?.(([_k, possibleItem], j) => {
      if (!possibleItem) {
        return;
      }
      const isConsumable = consumablePrototypeSIDs.has(possibleItem?.ItemPrototypeSID);
      const isAmmo = ammoPrototypeSIDs.has(possibleItem?.ItemPrototypeSID);
      const isGrenade = grenadePrototypeSIDs.has(possibleItem?.ItemPrototypeSID);
      if (!isConsumable && !isAmmo && !isGrenade) {
        return;
      }
      let chance = semiRandom(i + j + context.index);
      while (chance > 0.02) {
        chance /= 2;
      }
      const fork = possibleItem.fork();
      fork.Chance = parseFloat(chance.toFixed(4));
      if (possibleItem.MinCount) fork.MinCount = 1;
      if (isConsumable || isGrenade) {
        if (possibleItem.MaxCount) fork.MaxCount = 1;
      }
      if (isAmmo) {
        if (possibleItem.MaxCount) fork.MaxCount = Math.floor(semiRandom(context.index) * 9) + 1;
        if (possibleItem.AmmoMinCount) fork.AmmoMinCount = 1;
        if (possibleItem.AmmoMaxCount) fork.AmmoMaxCount = Math.floor(semiRandom(context.index) * 9) + 1;
      }
      return fork;
    });

    if (PossibleItems?.entries().length) {
      return Object.assign(fork, { PossibleItems });
    }
  });

  if (!ItemGenerator?.entries().length) {
    return;
  }

  return markAsForkRecursively(Object.assign(struct.fork(), { ItemGenerator }));
};
transformItemGeneratorPrototypes.files = ["/ItemGeneratorPrototypes.cfg", "/ItemGeneratorPrototypes/Gamepass_ItemGenerators.cfg"];
const prohibitedIds = ["Arena"];

const ammoPrototypeSIDs = new Set(Object.keys(allDefaultAmmoPrototypesRecord));
const consumablePrototypeSIDs = new Set(Object.keys(allDefaultConsumablePrototypesRecord));
const grenadePrototypeSIDs = new Set(Object.keys(allDefaultGrenadePrototypesRecord));
