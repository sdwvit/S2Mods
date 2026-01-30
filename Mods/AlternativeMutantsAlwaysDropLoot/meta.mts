import { ItemGeneratorPrototype, Struct } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `Mutants always drop 1 loot item.`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

const mutantLootSet = new Set([
  "BlinddogLootGenerator",
  "BloodsuckerLootGenerator",
  "BoarLootGenerator",
  "BurerLootGenerator",
  "CatLootGenerator",
  "ChimeraLootGenerator",
  "ControllerLootGenerator",
  "FleshLootGenerator",
  "PoltergeistLootGenerator",
  "PseudodogLootGenerator",
  "PseudogiantLootGenerator",
  "TushkanLootGenerator",
  "SnorkLootGenerator",
]);

function structTransformer(struct: ItemGeneratorPrototype) {
  if (mutantLootSet.has(struct.SID) && struct.ItemGenerator[0].PossibleItems[0].Chance !== 1) {
    const fork = struct.fork();

    fork.ItemGenerator = struct.ItemGenerator.fork();
    fork.ItemGenerator[0] = struct.ItemGenerator[0].fork();
    fork.ItemGenerator[0].PossibleItems = struct.ItemGenerator[0].PossibleItems.fork();
    fork.ItemGenerator[0].PossibleItems[0] = struct.ItemGenerator[0].PossibleItems[0].fork();
    fork.ItemGenerator[0].PossibleItems[0].Chance = 1;

    return fork;
  }
}

structTransformer.files = ["/ItemGeneratorPrototypes.cfg"];
