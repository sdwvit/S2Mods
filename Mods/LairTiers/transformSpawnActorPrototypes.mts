import { Struct, type SpawnActorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { lairActorFiles } from "../LairWars/hubLairs.mts";
import { lairsBySID } from "../LairWars/lairTiers.mts";

/**
 * Every lair with tiers spawns at every player rank (vanilla bands such as Master-only are opened up; the rank
 * blocks do the scaling), is switched on when vanilla leaves it off and no quest switches it on, and uses its
 * spawn-pool variant prototype when it has one.
 *
 * `NodePrototypeAppliedMods` makes this reach existing saves (the game respawns an actor whose prototype a mod
 * changed): saves from the copy/quest build had lairs pointed at `<Proto>_LT0`, which no longer exists.
 * Bump APPLIED_MOD_VERSION whenever this patch changes.
 */
const APPLIED_MOD_VERSION = 1;

export const transformSpawnActorPrototypes: StructTransformer<SpawnActorPrototype> = (struct) => {
  const lair = lairsBySID[struct.__internal__.rawName];
  if (!lair) return null;
  const fork = struct.fork();
  fork.MinSpawnRank = "ERank::Newbie";
  fork.MaxSpawnRank = "ERank::Master";
  if (lair.enabledByMod) fork.ActiveLair = true;
  if (lair.lairPrototypeSID !== struct.LairPrototypeSID) {
    fork.LairPrototypeSID = lair.lairPrototypeSID;
    fork.SpawnedPrototypeSID = lair.lairPrototypeSID;
  }
  fork.NodePrototypeAppliedMods = new Struct({
    __internal__: { bpatch: true },
    LairTiers: new Struct({ NodePrototypeModVersion: APPLIED_MOD_VERSION }),
  }) as any;
  return fork;
};

transformSpawnActorPrototypes.files = lairActorFiles.map((f) => f.slice(f.indexOf("/SpawnActorPrototypes/")));
transformSpawnActorPrototypes.inheritDuplicates = true;
