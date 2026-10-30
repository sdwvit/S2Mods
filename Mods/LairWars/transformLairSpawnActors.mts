import type { SpawnActorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { lairCopySID, lairFileSuffixes, lairsBySID, TIERS, tierLairPrototypeSID } from "./lairTiers.mts";

const ALL_RANKS = { min: "ERank::Newbie", max: "ERank::Master" } as const;

/**
 * Repoints the vanilla lair at its tier 0 prototype and stacks tier 1..9 copies on the same spot, in
 * the same file: they keep everything (position, volumes) and start switched off. Quest nodes switch
 * them on as Skif levels up (lairTierQuestNodes.mts).
 * Every lair spawns for every player rank (vanilla bands such as Master-only are opened up; the
 * tier's rank mix does the scaling), and a lair that vanilla leaves switched off with no quest to
 * switch it on starts switched on.
 */
export const transformLairSpawnActors: StructTransformer<SpawnActorPrototype> = (struct) => {
  const lair = lairsBySID[struct.__internal__.rawName];
  if (!lair) return null;

  const fork = struct.fork();
  fork.LairPrototypeSID = tierLairPrototypeSID(lair.lairPrototypeSID, 0);
  fork.SpawnedPrototypeSID = fork.LairPrototypeSID;
  fork.MinSpawnRank = ALL_RANKS.min;
  fork.MaxSpawnRank = ALL_RANKS.max;
  if (lair.enabledByMod) fork.ActiveLair = true;
  if (lair.tierZeroOnly) return fork;

  // Full copies: a `refkey` to a GUID that starts with digits renders as an index (`[38475]`) in
  // s2cfgtojson 9.1.0 (`isNumber` uses parseInt), so the copies don't inherit.
  const copies = TIERS.slice(1).map((tier) => {
    const sid = lairCopySID(lair.sid, tier);
    const copy = struct.clone();
    copy.__internal__.rawName = sid;
    copy.__internal__.isRoot = true;
    copy.SID = sid;
    copy.ActiveLair = false;
    copy.LairPrototypeSID = tierLairPrototypeSID(lair.lairPrototypeSID, tier);
    copy.SpawnedPrototypeSID = copy.LairPrototypeSID;
    copy.MinSpawnRank = ALL_RANKS.min;
    copy.MaxSpawnRank = ALL_RANKS.max;
    return copy;
  });
  return [fork, ...copies];
};

transformLairSpawnActors.files = lairFileSuffixes;
