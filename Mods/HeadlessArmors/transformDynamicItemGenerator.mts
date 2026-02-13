import { ItemGeneratorPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { adjustArmorItemGenerator } from "./adjustArmorItemGenerator.mts";
import {
  allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID,
  allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID,
  getFactionFromItemGeneratorSID,
} from "../../src/consts.mts";

/**
 * Allows NPCs to drop armor.
 */
export const transformDynamicItemGenerator: StructTransformer<ItemGeneratorPrototype> = async (struct) => {
  if (struct.SID.includes("Trade") || struct.SID === "empty" || /^all/i.test(struct.SID) || /^msdemo/i.test(struct.SID) || !struct.ItemGenerator) {
    return;
  }

  const canInjectNewItems =
    !!allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID] ||
    !!allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID];
  const canResolveFaction = !!getFactionFromItemGeneratorSID(struct.SID);
  const fork = struct.fork();
  let shouldReturn = false;
  /**
   * Iterate over existing head/body armor and mark entries as removenode. This way it won't conflict with other mods.
   */
  struct.ItemGenerator.forEach(([k, itemGenerator]) => {
    fork.ItemGenerator ||= struct.ItemGenerator.fork();
    fork.ItemGenerator.__internal__.useAsterisk = false;
    const categoryMatch =
      itemGenerator.Category === "EItemGenerationCategory::BodyArmor" || itemGenerator.Category === "EItemGenerationCategory::Head";
    const nonAsteriskKey = `${struct.ItemGenerator[k].__internal__.rawName}_dupe_${k}` as typeof k; // todo secret name sauce, add it to the lib as a util method
    if (categoryMatch || struct.ItemGenerator[k].__internal__.rawName === "[*]") {
      fork.ItemGenerator[nonAsteriskKey] ||= struct.ItemGenerator[k].fork();
    }

    if (categoryMatch) {
      const target = fork.ItemGenerator[nonAsteriskKey];

      itemGenerator.PossibleItems?.forEach?.(([possibleItemKey]) => {
        const possibleItem = struct.ItemGenerator[k].PossibleItems[possibleItemKey];
        const hasNonZeroChance = typeof possibleItem?.Chance === "number" && possibleItem.Chance !== 0;
        const shouldRemoveArmor = canInjectNewItems || hasNonZeroChance;
        if (!shouldRemoveArmor) {
          return;
        }

        target.Category = struct.ItemGenerator[k].Category;
        target.PlayerRank = struct.ItemGenerator[k].PlayerRank || "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master";
        target.PossibleItems ||= struct.ItemGenerator[k].PossibleItems.fork();
        target.PossibleItems[possibleItemKey] = possibleItem.fork();
        target.PossibleItems.removeNode(possibleItemKey);

        shouldReturn = true;
      });
    }
  });

  if (canInjectNewItems && canResolveFaction) {
    await adjustArmorItemGenerator(fork, struct.SID);
    shouldReturn = true;
  }
  if (shouldReturn) {
    return fork;
  }
};
transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg", "/ItemGeneratorPrototypes.cfg"];
