import { Struct } from "s2cfgtojson";

type StructType = Struct<{
  ItemGenerator?: Struct<{
    [key: `[${number | string}]`]: Struct<{
      Category: string;
      PlayerRank: string;
      PossibleItems: Struct<{
        [key: `[${number | string}]`]: Struct<{
          ItemPrototypeSID: string;
          Weight: number | string;
          MinDurability?: number | string;
          MaxDurability?: number | string;
          AmmoMinCount?: number;
          AmmoMaxCount?: number;
          Chance?: number;
        }>;
      }>;
    }>;
  }>;
  SpawnOnStart?: boolean;
  SpawnedPrototypeSID?: string;
  NPCType?: string;
  SID?: string;
  BuyCoefficient?: number;
  SellCoefficient?: number;
}>;

export const meta = {
  interestingFiles: [],
  interestingContents: [],
  prohibitedIds: [],
  interestingIds: [],
  description: "",
  changenote: "",
  entriesTransformer: (entries: StructType["entries"]) => {
    return {
      SpawnedPrototypeSID: entries.SpawnedPrototypeSID,
      SpawnOnStart: false,
    };
  },
};
