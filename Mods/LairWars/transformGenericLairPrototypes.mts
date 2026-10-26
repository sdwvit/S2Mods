import type { Struct } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";

/**
 * Expansion only sends out a squad of ExpansionResolverFactory.MinSquadSize (2) or more, so a lair needs a few
 * spare inhabitants to expand without emptying itself. Each lair group gets a MaxSpawnQuantity range; a group's
 * vanilla range (over all its lairs, factions and player ranks) is mapped linearly onto it, so relative sizes
 * inside the group stay as vanilla authored them. A group whose vanilla value never changes is spread by player
 * rank instead (Newbie low, Master high).
 */
type Range = [number, number];
type Group = { name: string; match: (sid: string) => boolean; range?: Range; factor?: number };

const sids = (...list: string[]) => (sid: string) => list.includes(sid);

/** First match wins. A group without range or factor keeps vanilla. */
export const LAIR_GROUPS: Group[] = [
  { name: "guards and rats (vanilla)", match: (sid) => sid.startsWith("Guard") || sid === "Rat" || sid.startsWith("RatSwarm") },
  { name: "bloodsuckers", match: sids("Bloodsucker"), range: [4, 6] },
  { name: "boars", match: sids("Boar"), range: [10, 10] },
  { name: "fleshes", match: sids("Flesh"), range: [10, 10] },
  { name: "snorks", match: sids("Snork"), range: [10, 14] },
  { name: "blind dogs", match: sids("Blinddog", "MoldyBlinddog"), range: [15, 18] },
  { name: "tushkans", match: sids("Tushkan"), range: [20, 30] },
  {
    name: "mixed lairs and living spaces",
    match: sids(
      "GenericMutantsOnly",
      "GenericHumansAndMutants",
      "BigLivingSpace",
      "SmallLivingSpace",
      "LivingUnderground",
      "WildUnderground",
      "WildField",
      "WildForest",
    ),
    range: [4, 30],
  },
  {
    // Vanilla 1-2 (Bayun 2): the loners, at the x4 that first brought them to at least 4.
    name: "lone mutants (x4)",
    match: (sid) =>
      ["Controller", "Chimera", "Burer", "Pseudogiant", "Pseudodog", "Deer", "Bayun"].includes(sid) || sid.startsWith("Poltergeist"),
    factor: 4,
  },
  { name: "humans", match: () => true, range: [10, 14] },
];

const RANKS = ["Newbie", "Experienced", "Veteran", "Master"];

const patched = (s: Struct) => {
  const fork = s.fork();
  fork.__internal__.bpatch = true;
  return fork;
};

const rankBlocks = (struct: Struct) =>
  (struct.Preset?.PossibleInhabitantFactions?.entries() ?? []).flatMap(([, faction]) =>
    (faction.SpawnSettingsPerPlayerRanks?.entries() ?? []).filter(([, rank]) => rank.MaxSpawnQuantity !== undefined),
  );

const groupOf = (struct: Struct) => LAIR_GROUPS.find((g) => g.match(struct.SID));

/** Vanilla [min, max] of every group, filled on first use from the whole file. */
let vanillaExtents: Map<Group, Range> | undefined;
const extentsFrom = (structs: Struct[]) => {
  const extents = new Map<Group, Range>();
  for (const struct of structs) {
    const group = groupOf(struct);
    if (!group) continue;
    for (const [, rank] of rankBlocks(struct)) {
      const [lo, hi] = extents.get(group) ?? [Infinity, -Infinity];
      extents.set(group, [Math.min(lo, rank.MaxSpawnQuantity), Math.max(hi, rank.MaxSpawnQuantity)]);
    }
  }
  return extents;
};

const scale = (group: Group, vanilla: number, rankKey: string) => {
  if (group.factor) return Math.ceil(vanilla * group.factor);
  const [lo, hi] = group.range!;
  const [vLo, vHi] = vanillaExtents!.get(group)!;
  const t = vHi > vLo ? (vanilla - vLo) / (vHi - vLo) : Math.max(0, RANKS.indexOf(rankKey)) / (RANKS.length - 1);
  return Math.round(lo + t * (hi - lo));
};

export function transformGenericLairPrototypes(struct: Struct, context: MetaContext<Struct>) {
  const group = groupOf(struct);
  const factions = struct.Preset?.PossibleInhabitantFactions;
  if (!factions || !group || (!group.range && !group.factor)) {
    return null;
  }
  vanillaExtents ??= extentsFrom(context.array);

  const fork = struct.fork();
  fork.Preset = patched(struct.Preset);
  fork.Preset.PossibleInhabitantFactions = patched(factions);

  for (const [factionKey, faction] of factions.entries()) {
    const ranks = faction.SpawnSettingsPerPlayerRanks;
    if (!ranks) continue;
    const factionFork = patched(faction);
    factionFork.SpawnSettingsPerPlayerRanks = patched(ranks);
    for (const [rankKey, rank] of ranks.entries()) {
      if (rank.MaxSpawnQuantity === undefined) continue;
      const rankFork = patched(rank);
      rankFork.MaxSpawnQuantity = scale(group, rank.MaxSpawnQuantity, rankKey);
      factionFork.SpawnSettingsPerPlayerRanks[rankKey] = rankFork;
    }
    fork.Preset.PossibleInhabitantFactions[factionKey] = factionFork;
  }
  return fork;
}

transformGenericLairPrototypes.files = ["/GenericLairPrototypes.cfg"];
