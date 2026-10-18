import type { QuestNodePrototype, QuestNodePrototypeItemAdd, SpawnActorPrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { readFileSync } from "node:fs";
import { getCfgFiles } from "../../src/get-cfg-files.mts";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";
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
 * Stashes a quest puts items into (ItemAdd) from a quest file outside
 * transformQuestNodePrototypes.files. hookStashSpawners never sees those ItemAdds, so
 * nothing would spawn the stash once hidden (e.g. the X18 key chest in SQ103); they keep
 * their vanilla spawn instead.
 */
function getUnhookedQuestStashes() {
  unhookedQuestStashes ??= (async () => {
    const hooked = transformQuestNodePrototypes.files;
    const files = (await getCfgFiles("/GameData/QuestNodePrototypes/", true)).filter(
      (f) => !hooked.some((h) => f.endsWith(h)) && readFileSync(f, "utf8").includes("EQuestNodeType::ItemAdd"),
    );
    const sids = new Set<string>();
    for (const file of files) {
      const structs = await readFileAndGetStructs<QuestNodePrototype>(file.split("/GameData/")[1]);
      structs.forEach((node) => {
        if (node.NodeType === "EQuestNodeType::ItemAdd" && (node as QuestNodePrototypeItemAdd).TargetQuestGuid) {
          sids.add((node as QuestNodePrototypeItemAdd).TargetQuestGuid);
        }
      });
    }
    return sids;
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
