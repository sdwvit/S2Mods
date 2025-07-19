import { Struct } from "s2cfgtojson";
type StructType = Struct<{
  SID: string;
  ItemGenerator: Struct<
    Record<
      string,
      Struct<{
        Category: string;
        PlayerRank: string;
        PossibleItems: Struct<
          Record<
            string,
            Struct<{
              ItemPrototypeSID: string;
              Weight: string;
              MinDurability: string;
              MaxDurability: string;
              Chance: string;
            }>
          >
        >;
      }>
    >
  >;
}>;
export const meta = {
  interestingFiles: ["DifficultyPrototypes", "AttachPrototypes"],
  interestingContents: [],
  prohibitedIds: [],
  interestingIds: [],
  description: "",
  changenote: "",
  entriesTransformer: (entries: StructType["entries"]) => {
    let keep = false;
    const interestingIdsSet = new Set(meta.interestingIds);
    Object.values(entries.ItemGenerator.entries).forEach((item) => {
      if (interestingIdsSet.has(item.entries?.Category)) {
        Object.values(item.entries.PossibleItems.entries).forEach((pos) => {
          if (pos.entries) {
            if (pos.entries.ItemPrototypeSID === "empty") {
              pos.entries = {} as typeof pos.entries;
            } else {
              keep =
                pos.entries.Weight == null ||
                pos.entries.MinDurability == null ||
                pos.entries.MaxDurability == null;

              const newObj = {
                ItemPrototypeSID: pos.entries.ItemPrototypeSID,
              } as typeof pos.entries;

              if (
                item.entries?.Category !== "EItemGenerationCategory::Attach"
              ) {
                newObj.MinDurability = pos.entries.MinDurability || "0.01";
                newObj.MaxDurability =
                  pos.entries.MaxDurability ||
                  (
                    Math.random() * 0.5 +
                    parseFloat(newObj.MinDurability.toString())
                  ).toFixed(3);
              }
              newObj.Weight = pos.entries.Weight || "1";
              let chance =
                parseFloat(pos.entries.Chance?.toString()) ||
                parseFloat((pos.entries.Weight || 1).toString()) / 1000;
              while (chance > 0.05) {
                chance /= 10;
              }
              newObj.Chance = chance.toFixed(3);
              pos.entries = newObj;
              delete item.entries.Category;
              delete item.entries.PlayerRank;
              delete entries.SID;
            }
          }
        });
      } else {
        if (item.entries) item.entries = {} as typeof item.entries; // remove non-interesting categories
      }
    });

    return keep ? entries : null;
  },
};
