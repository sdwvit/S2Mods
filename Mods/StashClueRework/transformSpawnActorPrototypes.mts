import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";

export const allStashes: Map<string, number> = new Map();

// Stash SIDs are collected while the (concurrent) file dispatch runs, so insertion order
// depends on which file resolves first. Indices are therefore assigned only once, from a
// sorted key list, by finalizeStashes() — called by readers right after the barrier.
const collectedStashSIDs = new Set<string>();
let stashesFinalized = false;

/** Idempotently assigns deterministic indices to every collected stash. */
export function finalizeStashes(): Map<string, number> {
  if (stashesFinalized) return allStashes;
  stashesFinalized = true;
  [...collectedStashSIDs].sort().forEach((sid, i) => allStashes.set(sid, i));
  return allStashes;
}
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
  collectedStashSIDs.add(struct.SID);

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
