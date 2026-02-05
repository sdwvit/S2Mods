import { ItemGeneratorPrototype } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { adjustArmorItemGenerator } from "./adjustArmorItemGenerator.mts";
import { addMissingCategories } from "../../src/add-missing-categories.mts";

/**
 * Allows NPCs to drop armor.
 */
export const transformDynamicItemGenerator: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
    return;
  }

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
    const nonAsteriskKey = `${struct.ItemGenerator[k].__internal__.rawName}_dupe_${k}` as typeof k; // secret name sause
    if (categoryMatch || struct.ItemGenerator[k].__internal__.rawName === "[*]") {
      fork.ItemGenerator[nonAsteriskKey] ||= struct.ItemGenerator[k].fork();
    }

    if (categoryMatch) {
      const target = fork.ItemGenerator[nonAsteriskKey];

      itemGenerator.PossibleItems?.forEach?.(([possibleItemKey]) => {
        target.Category = struct.ItemGenerator[k].Category;
        target.PlayerRank = struct.ItemGenerator[k].PlayerRank || "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master";
        target.PossibleItems ||= struct.ItemGenerator[k].PossibleItems.fork();
        target.PossibleItems[possibleItemKey] = struct.ItemGenerator[k].PossibleItems[possibleItemKey].fork();
        target.PossibleItems.removeNode(possibleItemKey);

        shouldReturn = true;
      });
    }
  });

  addMissingCategories(struct.ItemGenerator, fork.ItemGenerator);
  adjustArmorItemGenerator(fork, struct.SID);
  if (shouldReturn) {
    return fork;
  }
};
transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg", "/ItemGeneratorPrototypes.cfg"];
