import { ItemGeneratorPrototype, Struct } from "s2cfgtojson";
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
  const ig = struct.ItemGenerator.filter(([_k, ig]) => !!ig.PlayerRank);
  addMissingCategories(ig);

  const ItemGenerator = ig.map(([_k, itemGenerator], i) => {
    // noinspection FallThroughInSwitchStatementJS
    switch (itemGenerator.Category) {
      case "EItemGenerationCategory::Head":
      case "EItemGenerationCategory::BodyArmor":
        return adjustArmorItemGenerator(struct, itemGenerator, i) as any;
    }
  });
  ItemGenerator.__internal__.useAsterisk = false;
  ItemGenerator.__internal__.bpatch = true;

  if (
    !ItemGenerator.entries().length ||
    !ItemGenerator.filter((e): e is any => (e[1].PossibleItems as Struct).entries().length > 1).entries().length
  ) {
    return;
  }

  return Object.assign(struct.fork(), { ItemGenerator });
};
transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
