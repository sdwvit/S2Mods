import { DynamicItemGenerator, ERank, Struct } from "s2cfgtojson";

export function addMissingCategories(struct: DynamicItemGenerator) {
  const categories = new Set(struct.ItemGenerator.entries().map(([_k, ig]) => ig.Category));
  categories.add("EItemGenerationCategory::Head");
  categories.add("EItemGenerationCategory::BodyArmor");
  categories.forEach((Category) => {
    const generators = struct.ItemGenerator.entries().filter(([_k, ig]) => ig.Category === Category);
    const genRanks = new Set(
      generators.flatMap(([_k, ig]) => (ig.PlayerRank ? ig.PlayerRank.split(",").map((r) => r.trim()) : [])),
    );
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
export const ALL_RANKS_ARR: ERank[] = ["ERank::Newbie", "ERank::Experienced", "ERank::Veteran", "ERank::Master"];
export const ALL_RANKS_SET = new Set(["ERank::Newbie", "ERank::Experienced", "ERank::Veteran", "ERank::Master"]);
export const ALL_RANK = "ERank::Newbie, ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;
export const MASTER_RANK = "ERank::Master" as ERank;
export const VETERAN_MASTER_RANK = "ERank::Veteran, ERank::Master" as ERank;
export const EXPERIENCED_MASTER_RANK = "ERank::Experienced, ERank::Veteran, ERank::Master" as ERank;
