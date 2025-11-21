import { DynamicItemGenerator, Struct } from "s2cfgtojson";
import { adjustArmorItemGenerator } from "./adjustArmorItemGenerator.mjs";
import { addMissingCategories } from "./addMissingCategories.mjs";
import { EntriesTransformer } from "../../src/metaType.mjs";

/**
 * Allows NPCs to drop armor.
 */
export const transformDynamicItemGenerator: EntriesTransformer<DynamicItemGenerator> = (struct) => {
  if (struct.SID.includes("Trade")) {
    return;
  }

  addMissingCategories(struct);

  const ItemGenerator = struct.ItemGenerator.map(([_k, itemGenerator], i) => {
    // noinspection FallThroughInSwitchStatementJS
    switch (itemGenerator.Category) {
      case "EItemGenerationCategory::Head":
      case "EItemGenerationCategory::BodyArmor":
        return adjustArmorItemGenerator(struct, itemGenerator as any, i);
    }
  });

  if (
    !ItemGenerator.entries().length ||
    !ItemGenerator.filter((e): e is any => !!(e[1].PossibleItems as Struct).entries().length).entries().length
  ) {
    return;
  }

  return Object.assign(struct.fork(), { ItemGenerator });
};

transformDynamicItemGenerator._name = "Allows NPCs to drop armor.";
transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
