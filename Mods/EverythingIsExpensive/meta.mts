import { Struct } from "s2cfgtojson";
type StructType = Struct<{ SellCoefficient: number }>;
export const meta = {
  interestingFiles: ["DifficultyPrototypes", "AttachPrototypes"],
  interestingContents: [],
  prohibitedIds: [],
  interestingIds: [],
  description: "",
  changenote: "",
  entriesTransformer: (entries: StructType["entries"]) => {
    return entries;
  },
};
