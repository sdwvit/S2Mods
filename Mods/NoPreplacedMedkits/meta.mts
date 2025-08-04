import { Struct } from "s2cfgtojson";
import * as fs from "node:fs";
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
let allItems = [];
export const meta = {
  interestingFiles: ["WorldMap_WP"],
  interestingContents: ["ESpawnType::Item", "ESpawnType::PackOfItems", ...items],
  prohibitedIds: [],
  interestingIds: [],
  description: `This mode does only one thing: removes all 650+ medkits placed around the map for more challenging gameplay.
---
😤 Tired of those cute little medkits scattered around the map like breadcrumbs for weaklings?
💀 This mod is for players who want to feel the sting of death without any pre-placed safety nets.
🕸️ Increased tension. Every bullet, tripwire, and mutant encounter feels like a 10/10 horror movie.
⚰️ Achievement unlocked: “I DIED 47 TIMES BEFORE REACHING ZALISSYA.”
---
It is meant to be used in other collections of mods. Does not conflict with anything.
---
Thanks @rbwadle for suggesting how to modify map objects.`,
  changenote: "Game wants a few more properties on struct descriptor to be considered valid",
  entriesTransformer: (entries: StructType["entries"], c) => {
    if (
      items.some((i) => entries.ItemSID?.includes(i) || entries.PackOfItemsPrototypeSID?.includes(i)) &&
      spawnTypes.some((s) => entries.SpawnType === s)
    ) {
      console.info(c + `Found preplaced item: ${entries.ItemSID || entries.PackOfItemsPrototypeSID}. Hiding it.`);
      const newEntries: any = {
        SpawnOnStart: false,
        SpawnType: entries.SpawnType,
        SID: entries.SID,
      };
      if (entries.ItemSID) {
        newEntries.ItemSID = entries.ItemSID;
      }
      if (entries.PackOfItemsPrototypeSID) {
        newEntries.PackOfItemsPrototypeSID = entries.PackOfItemsPrototypeSID;
      }
      allItems.push({
        x: entries.PositionX,
        y: entries.PositionY,
        description: "Medkit",
      });
      return newEntries;
    }
    return null;
  },
  onFinish: () => {
    fs.writeFileSync(
      "/home/sdwvit/MX500-900/games/stalker-modding/Output/Exports/Mods/mapPoints.json",
      JSON.stringify(allItems, null, 2),
    );
  },
};
