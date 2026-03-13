import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";

export const allStashes: Map<string, number> = new Map();
export function transformSpawnActorPrototypes(struct: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  if (struct.SpawnType === "ESpawnType::ItemContainer") {
    return rememberAndEmptyStash(struct, context);
  }

  return null;
}

export const getGeneratedStashSID = (i: number) => `Gen_Stash${i}`;

export function rememberAndEmptyStash(struct: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  if (struct.ClueVariablePrototypeSID !== "EmptyInherited" || !containers.has(struct.SpawnedPrototypeSID)) {
    return;
  }
  const fork = struct.fork();
  allStashes.set(struct.SID, allStashes.size);

  fork.ClueVariablePrototypeSID = getGeneratedStashSID((context.fileIndex % 100) + 1);
  fork.SpawnOnStart = false;

  return fork;
}

const containers = new Set([
  "BlueBox",
  "BigSafe",
  "SmallSafe",
  "Bag",
  "Backpack",
  "BackpackGrave_g",
  "BackpackGrave_h",
  "BackpackGrave_i",
  "BackpackGrave_j",
  "PackOfItemsBase",
  "BasicFoodCache",
  "BasicClueStatsCache",
  "BasicMixedCache",
  "NewbieCacheContainer",
  "ExperiencedCacheContainer",
  "VeteranCacheContainer",
  "MasterCacheContainer",
  "CarouselExplosionBag",
]);

transformSpawnActorPrototypes.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = [...containers, "ESpawnType::ItemContainer"];
