import { Struct } from "s2cfgtojson";
type StructType = Struct<{
  SpawnType: "ESpawnType::Item";
  ItemSID: `${string}Armor${string}`;
  SID: string;
  SpawnOnStart: boolean;
  PositionX: number;
  PositionY: number;
  PositionZ: number;
  RotatorAngleYaw: number;
  RotatorAnglePitch: number;
  RotatorAngleRoll: number;
  ScaleX: number;
  ScaleY: number;
  ScaleZ: number;
  TextAboveActor: string;
  DLC: string;
  LevelName: string;
  PlaceholderActorGuid: string;
  PlaceholderMapPath: string;
  MeshPath: string;
  SpawnedPrototypeSID: string;
  Durability: number;
  DisablePhysicsAndCollision: boolean;
}>;
const items = ["Gun", "Armor", "Helmet"];

export const meta = {
  interestingFiles: ["WorldMap_WP"],
  interestingContents: ["ESpawnType::Item", ...items],
  prohibitedIds: [],
  interestingIds: [],
  description: "",
  changenote: "",
  entriesTransformer: (entries: StructType["entries"]) => {
    if (
      items.some((i) => entries.ItemSID?.includes(i)) &&
      entries.SpawnType === "ESpawnType::Item"
    ) {
      console.info(`Found preplaced item: ${entries.ItemSID}. Hiding it.`);
      const newEntries: any = {
        SpawnOnStart: false,
        SpawnType: entries.SpawnType,
        SID: entries.SID,
      };
      if (entries.ItemSID) {
        newEntries.ItemSID = entries.ItemSID;
      }
      return newEntries;
    }
    return null;
  },
};
