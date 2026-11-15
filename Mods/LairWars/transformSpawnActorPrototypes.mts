import { Struct, type SpawnActorPrototype } from "s2cfgtojson";
import { hubLairs, isGuardLairPrototype, lairActorFiles } from "./hubLairs.mts";
import { lairsBySID } from "./lairTiers.mts";
import { mutantLairActors } from "./mutantLairs.mts";
import { mutantLairPrototypes, regionLairPrototype } from "./regionTiers.mts";

/**
 * Every lair on the map:
 * - can be captured (vanilla: 124 of 393, the IPSF posts and resting camps are false), except hub lairs
 *   (`hubLairs.mts`: the guards and the residents' camps inside a hub), which keep vanilla's flag;
 * - for lairs with tiers (`lairs` in lairTiers.mts): spawns at every player rank (vanilla bands such as
 *   Master-only are opened up; the rank blocks of the lair prototype do the scaling), is switched on when
 *   vanilla leaves it off and no quest switches it on, and uses its spawn-pool variant prototype when it has one;
 * - outside the hubs and outside R1: uses its region variant prototype (regionTiers.mts).
 *
 * `NodePrototypeAppliedMods` makes the change reach existing saves: the game deletes an already spawned actor
 * whose prototype a mod changed (a new mod entry or version) and spawns it again from the patched prototype
 * (DesignDocs/patchingExistignSpawnActorPrototypes.md). Bump APPLIED_MOD_VERSION whenever this patch changes.
 * Version 3 points lairs back at their vanilla prototypes (versions 1-2 used `<Proto>_LT0` tier prototypes).
 * Version 4 points lairs outside R1 at their region variants.
 * Version 5 drops the spawners' own PossibleInhabitantFactions (withoutOwnFactions).
 *
 * The first call also adds the new mutant lairs (mutantLairs.mts) to the file it patches.
 */
const APPLIED_MOD_VERSION = 5;

let lairsAdded = false;

export function transformSpawnActorPrototypes(struct: SpawnActorPrototype) {
  const added = lairsAdded ? [] : mutantLairActors(mutantLairPrototypes);
  lairsAdded = true;
  const patch = patchLair(struct);
  return added.length ? (patch ? [patch, ...added] : added) : patch;
}

function patchLair(struct: SpawnActorPrototype) {
  if (struct.SpawnType !== "ESpawnType::LairSpawner" || isGuardLairPrototype(struct.LairPrototypeSID)) return null;
  const lair = lairsBySID[struct.__internal__.rawName];
  const fork = lair && !hubLairs.has(struct.__internal__.rawName) && struct.PossibleInhabitantFactions ? withoutOwnFactions(struct) : struct.fork();
  if (lair) {
    fork.MinSpawnRank = "ERank::Newbie";
    fork.MaxSpawnRank = "ERank::Master";
    if (lair.enabledByMod) fork.ActiveLair = true;
    const prototype = regionLairPrototype[lair.sid] ?? lair.lairPrototypeSID;
    if (prototype !== struct.LairPrototypeSID) {
      fork.LairPrototypeSID = prototype;
      fork.SpawnedPrototypeSID = prototype;
    }
  }
  if (!hubLairs.has(struct.__internal__.rawName)) fork.CanBeCaptured = true;
  fork.NodePrototypeAppliedMods = new Struct({
    __internal__: { bpatch: true },
    LairWars: new Struct({ NodePrototypeModVersion: APPLIED_MOD_VERSION }),
  }) as any;
  return fork;
}

/**
 * 148 vanilla spawners carry their own `PossibleInhabitantFactions` (e.g. Pripyat's Monolith camps: Monolith only,
 * 2 per rank), which keeps out every other faction and ignores the lair prototype's sizes. A bpatch can't drop a
 * nested struct, so such a spawner is replaced whole (a top-level key without bpatch) by a copy without the list,
 * and it falls back to its lair prototype like the other 235 spawners.
 */
function withoutOwnFactions(struct: SpawnActorPrototype) {
  const copy = struct.clone();
  delete (copy as any).PossibleInhabitantFactions;
  copy.__internal__.bpatch = false;
  return copy;
}

transformSpawnActorPrototypes.files = lairActorFiles.map((f) => f.slice(f.indexOf("/SpawnActorPrototypes/")));
// No inheritDuplicates: it writes dotted sub-struct refkeys, which the game doesn't resolve (transformEnemyObjPrototypes.mts).
