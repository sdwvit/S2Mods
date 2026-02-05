import { EItemGenerationCategory, QuestNPCGeneratorPrototypeItemGenerator, Struct } from "s2cfgtojson";
import { ALL_RANKS_SET } from "./consts.mts";

export function addMissingCategories(
  itemGenerator: QuestNPCGeneratorPrototypeItemGenerator,
  forkItemGenerator: QuestNPCGeneratorPrototypeItemGenerator,
) {
  const categories = new Set<EItemGenerationCategory>();
  categories.add("EItemGenerationCategory::Head");
  categories.add("EItemGenerationCategory::BodyArmor");
  categories.forEach((Category) => {
    if (!Category) {
      return;
    }
    const generators = itemGenerator.entries().filter(([_k, ig]) => ig.Category === Category);
    const genRanks = new Set(generators.flatMap(([_k, ig]) => (ig.PlayerRank ? ig.PlayerRank.split(",").map((r) => r.trim()) : [])));
    const missingRanks = ALL_RANKS_SET.difference(genRanks);
    if (generators.length) {
      [...missingRanks].forEach((mr) => {
        forkItemGenerator.addNode(
          new Struct({
            Category,
            PlayerRank: mr,
            bAllowSameCategoryGeneration: true,
            PossibleItems: {},
          }),
          `${Category.replace("EItemGenerationCategory::", "")}_for_${mr.replace("ERank::", "")}`,
        );
      });
    }
  });
}
