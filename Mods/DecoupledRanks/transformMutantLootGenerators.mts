import type { ItemGeneratorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { MutantLootDefinitions } from "./addMutantPartItems.mts";

const mutantLootGeneratorMap: Record<string, string> = {};
for (const { SID, questSID } of MutantLootDefinitions) {
  mutantLootGeneratorMap[SID.replace("Loot", "LootGenerator")] = questSID;
}

export const transformMutantLootGenerators: StructTransformer<ItemGeneratorPrototype> = (struct) => {
  const questSID = mutantLootGeneratorMap[struct.SID];
  if (!questSID) return;

  const fork = struct.fork();
  fork.ItemGenerator = struct.ItemGenerator.fork();
  fork.ItemGenerator[0] = struct.ItemGenerator[0].fork();
  fork.ItemGenerator[0].PossibleItems = struct.ItemGenerator[0].PossibleItems.fork();
  fork.ItemGenerator[0].PossibleItems[0] = struct.ItemGenerator[0].PossibleItems[0].fork();
  fork.ItemGenerator[0].PossibleItems[0].ItemPrototypeSID = questSID;

  return fork;
};
transformMutantLootGenerators.files = ["/ItemGeneratorPrototypes.cfg"];
