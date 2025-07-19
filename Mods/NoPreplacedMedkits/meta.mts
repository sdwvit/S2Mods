import { Struct } from "s2cfgtojson";
type StructType = Struct<{
  SpawnType: "ESpawnType::Item";
  ItemSID?: string;
  PackOfItemsPrototypeSID?: string;
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
const items = ["Medkit"];
const spawnTypes = ["ESpawnType::Item", "ESpawnType::PackOfItems"];

export const meta = {
  interestingFiles: ["WorldMap_WP"],
  interestingContents: [
    "ESpawnType::Item",
    "ESpawnType::PackOfItems",
    ...items,
  ],
  prohibitedIds: [],
  interestingIds: [],
  description: "",
  changenote: "",
  entriesTransformer: (entries: StructType["entries"]) => {
    if (
      items.some(
        (i) =>
          entries.ItemSID?.includes(i) ||
          entries.PackOfItemsPrototypeSID?.includes(i),
      ) &&
      spawnTypes.some((s) => entries.SpawnType === s)
    ) {
      console.info(
        `Found preplaced item: ${entries.ItemSID || entries.PackOfItemsPrototypeSID}. Hiding it.`,
      );
      const newEntries: {
        SpawnOnStart: boolean;
        ItemSID?: string;
        PackOfItemsPrototypeSID?: string;
      } = {
        SpawnOnStart: false,
      };
      if (entries.ItemSID) {
        newEntries.ItemSID = entries.ItemSID;
      }
      if (entries.PackOfItemsPrototypeSID) {
        newEntries.PackOfItemsPrototypeSID = entries.PackOfItemsPrototypeSID;
      }
      return newEntries;
    }
    return null;
  },
};
