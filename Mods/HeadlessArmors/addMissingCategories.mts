import { DynamicItemGenerator, ERank, Struct } from "s2cfgtojson";

export function addMissingCategories(struct: DynamicItemGenerator) {
  const categories = struct.ItemGenerator.entries().map(([_k, ig]) => ig.Category);
  categories.forEach((Category) => {
    const generators = struct.ItemGenerator.entries().filter(([_k, ig]) => ig.Category === Category);
    const genRanks = new Set(
      generators.flatMap(([_k, ig]) => (ig.PlayerRank ? ig.PlayerRank.split(",").map((r) => r.trim()) : [])),
    );
    const missingRanks = allRanksSet.difference(genRanks);
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
export const allRanks: ERank[] = ["ERank::Newbie", "ERank::Experienced", "ERank::Veteran", "ERank::Master"];
export const allRanksSet = new Set(["ERank::Newbie", "ERank::Experienced", "ERank::Veteran", "ERank::Master"]);
