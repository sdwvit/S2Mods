import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { readFileSync } from "node:fs";
import { getCfgFiles } from "../../src/get-cfg-files.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";

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
export async function transformSpawnActorPrototypes(struct: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  if (struct.SpawnType === "ESpawnType::ItemContainer") {
    if ((await getUnhookedQuestStashes()).has(struct.SID)) {
      return;
    }
    return rememberAndEmptyStash(struct, context);
  }

  return null;
}

let unhookedQuestStashes: Promise<Set<string>> | undefined;

/**
 * Stashes a quest uses without going through hookStashSpawners: an ItemAdd from a quest file
 * outside transformQuestNodePrototypes.files (e.g. the X18 key chest in SQ103), or any other
 * node that targets the container — Spawn, ItemRemove, MoveInventory MoveFrom/MoveTo, ...
 * (e.g. the Rostok arena safes that hold the player's gear between rounds in SQ20).
 * Hiding those breaks the quest, so they keep their vanilla spawn. Stashes with a hooked
 * ItemAdd stay in the pool: hookStashSpawners spawns them when the quest fills them.
 */
function getUnhookedQuestStashes() {
  unhookedQuestStashes ??= (async () => {
    const hooked = transformQuestNodePrototypes.files;
    const files = await getCfgFiles("/GameData/QuestNodePrototypes/", true);
    const referenced = new Set<string>();
    const hookedItemAdds = new Set<string>();
    for (const file of files) {
      const isHooked = hooked.some((h) => file.endsWith(h));
      // Plain-text scan of top-level node fields; parsing all ~1300 quest files is too slow.
      for (const block of readFileSync(file, "utf8").split(/^\S[^\n]* : struct\.begin/m)) {
        const isItemAdd = /^\s*NodeType = EQuestNodeType::ItemAdd\s*$/m.test(block);
        for (const [, guid] of block.matchAll(/^(?:\t| {2,4})(?:TargetQuestGuid|MoveFrom|MoveTo) = ([0-9A-F]{32})\s*$/gm)) {
          (isItemAdd && isHooked ? hookedItemAdds : referenced).add(guid);
        }
      }
    }
    hookedItemAdds.forEach((guid) => referenced.delete(guid));
    return referenced;
  })();
  return unhookedQuestStashes;
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
