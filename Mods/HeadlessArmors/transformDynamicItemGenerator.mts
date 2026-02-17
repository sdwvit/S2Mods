import { ItemGeneratorPrototype, ItemGeneratorPrototypeItemGeneratorItem, Struct } from "s2cfgtojson";
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

  const canResolveFaction = !!getFactionFromItemGeneratorSID(struct.SID);
  const fork = struct.fork();
  let shouldReturn = false;
  const canInjectNewItems =
    !!allDefaultGeneralNPCObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID] ||
    !!allDefaultQuestObjPrototypesRecordByItemGeneratorPrototypeSID[struct.SID];
  /**
   * Iterate over existing head/body armor and remove entries by overriding with Struct.
   */
  struct.ItemGenerator.forEach(([k, itemGenerator]) => {
    fork.ItemGenerator ||= struct.ItemGenerator.fork();
    fork.ItemGenerator.__internal__.useAsterisk = false;

    const categoryMatch =
      itemGenerator.Category === "EItemGenerationCategory::BodyArmor" || itemGenerator.Category === "EItemGenerationCategory::Head";
    const nonAsteriskKey = `${itemGenerator.__internal__.rawName}_dupe_${k}` as typeof k; // todo secret name sauce, add it to the lib as a util method
    if (categoryMatch || itemGenerator.__internal__.rawName === "[*]") {
      fork.ItemGenerator[nonAsteriskKey] ||= itemGenerator.fork() as ItemGeneratorPrototypeItemGeneratorItem;
    }

    if (categoryMatch) {
      const target = fork.ItemGenerator[nonAsteriskKey];

      itemGenerator.PossibleItems?.forEach?.(([_, possibleItem]) => {
        const hasNonZeroChance = typeof possibleItem?.Chance === "number" && possibleItem.Chance !== 0;
        const shouldRemoveArmor = canInjectNewItems || hasNonZeroChance;
        if (shouldRemoveArmor) {
          shouldReturn = true;
        }
      });
      if (shouldReturn) {
        target.PossibleItems = new Struct() as any;
        if (itemGenerator.PlayerRank) target.PlayerRank = itemGenerator.PlayerRank; // I think these are mandatory
        if (itemGenerator.Category) target.Category = itemGenerator.Category; // I think these are mandatory
        target.bAllowSameCategoryGeneration = true;
        target.removeNode("PossibleItems");
      }
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
