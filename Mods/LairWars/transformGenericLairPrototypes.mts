import type { Struct } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { tierArchetypes, variantPrototype, variantPrototypeSIDs, type RankName } from "./lairTiers.mts";
import { addedFactionBlocks } from "./openLairs.mts";

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

/** Every scaled lair holds this much more than its LAIR_GROUPS size (applied after the range mapping). */
export const CAPACITY_FACTOR = 1.5;
/** Refill and wipe timers of every scaled lair, as a share of vanilla (180/480/480 s -> 60/160/160 s). */
export const RESPAWN_TIME_FACTOR = 1 / 3;
const RESPAWN_TIME_FIELDS = ["InitialSpawnQuantityRespawnTimeSeconds", "MaxSpawnQuantityRespawnTimeSeconds", "WipeRespawnTimeoutSeconds"] as const;

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
const isScaled = (group: Group | undefined): group is Group => !!(group?.range || group?.factor);

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

const scale = (group: Group, vanilla: number, rankKey: string) => Math.round(scaleToGroup(group, vanilla, rankKey) * CAPACITY_FACTOR);

const scaleToGroup = (group: Group, vanilla: number, rankKey: string) => {
  if (group.factor) return Math.ceil(vanilla * group.factor);
  const [lo, hi] = group.range!;
  const [vLo, vHi] = vanillaExtents!.get(group)!;
  const t = vHi > vLo ? (vanilla - vLo) / (vHi - vLo) : Math.max(0, RANKS.indexOf(rankKey)) / (RANKS.length - 1);
  return Math.round(lo + t * (hi - lo));
};

/** Scales every rank's MaxSpawnQuantity of a faction block in place (a full block, not a patch). */
function scaleFactionBlock(faction: Struct, group: Group) {
  for (const [rankKey, rank] of faction.SpawnSettingsPerPlayerRanks?.entries() ?? []) {
    if (rank.MaxSpawnQuantity !== undefined) rank.MaxSpawnQuantity = scale(group, rank.MaxSpawnQuantity, rankKey);
  }
}

let once = false;

/**
 * Patches every vanilla lair prototype: tier mixes in its player-rank blocks (lairTiers.mts), bigger sizes
 * (LAIR_GROUPS) and every faction allowed in (openLairs.mts). The first call also emits the prototypes the mod
 * adds, so they come first in the file.
 */
export function transformGenericLairPrototypes(struct: Struct, context: MetaContext<Struct>) {
  vanillaExtents ??= extentsFrom(context.array);
  const out: Struct[] = [];
  if (!once) {
    once = true;
    // Variants inherit their vanilla prototype, patched below with sizes, tiers and factions.
    out.push(...variantPrototypeSIDs.map(variantPrototype));
  }
  const patch = patchVanillaLair(struct);
  if (patch) out.push(patch);
  return out.length ? out : null;
}

function patchVanillaLair(struct: Struct) {
  const group = groupOf(struct);
  const scaled = isScaled(group);
  const tiered = tierArchetypes[struct.__internal__.rawName];
  const factions = struct.Preset?.PossibleInhabitantFactions;
  const added = addedFactionBlocks(struct as any);
  if (!factions || (!scaled && !tiered && !added.length)) return null;

  const fork = struct.fork();
  fork.Preset = patched(struct.Preset);
  fork.Preset.PossibleInhabitantFactions = patched(factions);

  if (scaled || tiered) {
    for (const [factionKey, faction] of factions.entries()) {
      const ranks = faction.SpawnSettingsPerPlayerRanks;
      if (!ranks) continue;
      const tieredRanks = tiered?.[factionKey];
      const factionFork = patched(faction);
      factionFork.SpawnSettingsPerPlayerRanks = patched(ranks);
      for (const [rankKey, rank] of ranks.entries()) {
        const rankFork = patched(rank);
        if (scaled && rank.MaxSpawnQuantity !== undefined) rankFork.MaxSpawnQuantity = scale(group, rank.MaxSpawnQuantity, rankKey);
        if (scaled) {
          for (const field of RESPAWN_TIME_FIELDS) {
            if (rank[field] !== undefined) rankFork[field] = Math.round(Number(rank[field]) * RESPAWN_TIME_FACTOR);
          }
        }
        // Without bpatch: the tier's archetype list replaces vanilla's whole.
        const archetypes = tieredRanks?.[rankKey as RankName];
        if (archetypes) rankFork.SpawnSettingsPerArchetypes = archetypes;
        factionFork.SpawnSettingsPerPlayerRanks[rankKey] = rankFork;
      }
      fork.Preset.PossibleInhabitantFactions[factionKey] = factionFork;
    }
  }
  for (const [factionKey, block] of added) {
    if (scaled) scaleFactionBlock(block, group);
    fork.Preset.PossibleInhabitantFactions.addNode(block, factionKey);
  }
  return fork;
}

transformGenericLairPrototypes.files = ["/GenericLairPrototypes.cfg"];
transformGenericLairPrototypes.inheritDuplicates = true;
