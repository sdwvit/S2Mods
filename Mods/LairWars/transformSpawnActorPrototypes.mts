import { Struct, type SpawnActorPrototype } from "s2cfgtojson";
import { hubLairs, isGuardLairPrototype, lairActorFiles } from "./hubLairs.mts";
import { lairsBySID } from "./lairTiers.mts";

/**
 * Every lair on the map:
 * - can be captured (vanilla: 124 of 393, the IPSF posts and resting camps are false), except hub lairs
 *   (`hubLairs.mts`: the guards and the residents' camps inside a hub), which keep vanilla's flag;
 * - for lairs with tiers (`lairs` in lairTiers.mts): spawns at every player rank (vanilla bands such as
 *   Master-only are opened up; the rank blocks of the lair prototype do the scaling), is switched on when
 *   vanilla leaves it off and no quest switches it on, and uses its spawn-pool variant prototype when it has one.
 *
 * `NodePrototypeAppliedMods` makes the change reach existing saves: the game deletes an already spawned actor
 * whose prototype a mod changed (a new mod entry or version) and spawns it again from the patched prototype
 * (DesignDocs/patchingExistignSpawnActorPrototypes.md). Bump APPLIED_MOD_VERSION whenever this patch changes.
 * Version 3 points lairs back at their vanilla prototypes (versions 1-2 used `<Proto>_LT0` tier prototypes).
 */
const APPLIED_MOD_VERSION = 3;

export function transformSpawnActorPrototypes(struct: SpawnActorPrototype) {
  if (struct.SpawnType !== "ESpawnType::LairSpawner" || isGuardLairPrototype(struct.LairPrototypeSID)) return null;
  const fork = struct.fork();
  const lair = lairsBySID[struct.__internal__.rawName];
  if (lair) {
    fork.MinSpawnRank = "ERank::Newbie";
    fork.MaxSpawnRank = "ERank::Master";
    if (lair.enabledByMod) fork.ActiveLair = true;
    if (lair.lairPrototypeSID !== struct.LairPrototypeSID) {
      fork.LairPrototypeSID = lair.lairPrototypeSID;
      fork.SpawnedPrototypeSID = lair.lairPrototypeSID;
    }
  }
  if (!hubLairs.has(struct.__internal__.rawName)) fork.CanBeCaptured = true;
  fork.NodePrototypeAppliedMods = new Struct({
    __internal__: { bpatch: true },
    LairWars: new Struct({ NodePrototypeModVersion: APPLIED_MOD_VERSION }),
  }) as any;
  return fork;
}

transformSpawnActorPrototypes.files = lairActorFiles.map((f) => f.slice(f.indexOf("/SpawnActorPrototypes/")));
transformSpawnActorPrototypes.inheritDuplicates = true;
