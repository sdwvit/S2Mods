import { DynamicItemGenerator, Struct } from "s2cfgtojson";
import { ALL_RANKS_SET } from "./consts.mts";

export function addMissingCategories(struct: DynamicItemGenerator) {
  const categories = new Set(struct.ItemGenerator.entries().map(([_k, ig]) => ig.Category));
  categories.add("EItemGenerationCategory::Head");
  categories.add("EItemGenerationCategory::BodyArmor");
  categories.forEach((Category) => {
    const generators = struct.ItemGenerator.entries().filter(([_k, ig]) => ig.Category === Category);
    const genRanks = new Set(generators.flatMap(([_k, ig]) => (ig.PlayerRank ? ig.PlayerRank.split(",").map((r) => r.trim()) : [])));
    const missingRanks = ALL_RANKS_SET.difference(genRanks);
    if (generators.length) {
      [...missingRanks].forEach((mr) => {
        struct.ItemGenerator.addNode(
          new Struct({
            Category,
            PlayerRank: mr,
            bAllowSameCategoryGeneration: true,
            PossibleItems: new Struct({
              __internal__: { rawName: "PossibleItems", isArray: true },
            }),
          }),
          `${Category.replace("EItemGenerationCategory::", "")}_for_${mr.replace("ERank::", "_")}`,
        );
      });
    }
  });
}
