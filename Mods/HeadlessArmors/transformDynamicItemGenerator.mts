import { DynamicItemGenerator, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { adjustArmorItemGenerator } from "./adjustArmorItemGenerator.mts";
import { addMissingCategories } from "../../src/add-missing-categories.mts";

/**
 * Allows NPCs to drop armor.
 */
export const transformDynamicItemGenerator: StructTransformer<DynamicItemGenerator> = (struct) => {
  if (struct.SID.includes("Trade") || !struct.ItemGenerator) {
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
  ItemGenerator.__internal__.useAsterisk = false;
  ItemGenerator.__internal__.bpatch = true;

  if (!ItemGenerator.entries().length || !ItemGenerator.filter((e): e is any => (e[1].PossibleItems as Struct).entries().length > 1).entries().length) {
    return;
  }

  return Object.assign(struct.fork(), { ItemGenerator });
};
transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
