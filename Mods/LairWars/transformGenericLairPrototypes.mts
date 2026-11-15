import { Struct, type GenericLairPrototype } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { tierArchetypes, vanillaLairPrototypes, vanillaOf, variantPrototype, variantPrototypeSIDs, type RankName } from "./lairTiers.mts";
import { regionVariants, type RankBlock } from "./regionTiers.mts";
import { addedFactionBlocks, donorOf } from "./openLairs.mts";

/**
 * Expansion squads leave a few inhabitants at a time (transformNPCNeedsPresetPrototypes.mts), so a lair needs a few
 * spare inhabitants to expand without emptying itself. Each lair group gets a MaxSpawnQuantity range; a group's
 * vanilla range (over all its lairs, factions and player ranks) is mapped linearly onto it, so relative sizes
 * inside the group stay as vanilla authored them. A group whose vanilla value never changes is spread by player
 * rank instead (Newbie low, Master high).
 */
type Range = [number, number];
/** `range` is scaled by CAPACITY_FACTOR afterwards; `capacity` is the final range as written. */
/** `byRank`: spread over the range by player rank (Newbie low, Master high), whatever vanilla's sizes. */
type Group = { name: string; match: (sid: string) => boolean; range?: Range; capacity?: Range; byRank?: boolean };

const sids = (...list: string[]) => (sid: string) => list.includes(sid);

/**
 * First match wins. A group without range or capacity keeps vanilla.
 *
 * Single-species mutant lairs are sized by tier (BetterQuestRewards' base reward per enemy): the stronger the
 * mutant, the fewer per lair. S1 (tushkan, flesh, blind dog, boar, zombie) and the snork keep their sizes.
 * Sizes the user set by hand (2026-11-14) spread evenly by player rank (`byRank`).
 */
export const LAIR_GROUPS: Group[] = [
  { name: "guards and rat swarms (vanilla)", match: (sid) => sid.startsWith("Guard") || sid.startsWith("RatSwarm") },
  { name: "rats", match: sids("Rat"), capacity: [2, 3], byRank: true },
  // S2
  // Separate groups: vanilla Bayun is always 2, so on its own it spreads by rank instead of sitting at the top.
  { name: "bayuns", match: sids("Bayun"), capacity: [3, 5] },
  { name: "pseudodogs", match: sids("Pseudodog"), capacity: [3, 5], byRank: true },
  // S3
  { name: "bloodsuckers", match: sids("Bloodsucker"), capacity: [4, 6] },
  { name: "burers", match: sids("Burer"), capacity: [3, 5] },
  { name: "poltergeists", match: (sid) => sid.startsWith("Poltergeist"), capacity: [2, 4], byRank: true },
  { name: "controllers", match: sids("Controller"), capacity: [2, 8], byRank: true },
  // S4
  { name: "deer", match: sids("Deer"), capacity: [3, 6], byRank: true },
  { name: "pseudogiants and chimeras", match: sids("Pseudogiant", "Chimera"), capacity: [2, 6], byRank: true },
  { name: "boars", match: sids("Boar"), capacity: [12, 12] },
  { name: "fleshes", match: sids("Flesh"), capacity: [12, 12] },
  { name: "snorks", match: sids("Snork"), range: [10, 14] },
  { name: "blind dogs", match: sids("Blinddog", "MoldyBlinddog"), capacity: [15, 15] },
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
  { name: "humans", match: () => true, range: [10, 14] },
];

const RANKS = ["Newbie", "Experienced", "Veteran", "Master"];

/** Monolith camps hold more: every Monolith faction block's MaxSpawnQuantity x1.3 (own and open-lair blocks). */
export const MONOLITH_CAMP_FACTOR = 1.3;
const factionFactor = (faction: string) => (faction === "Monolith" ? MONOLITH_CAMP_FACTOR : 1);

/** Every scaled lair holds this much more than its LAIR_GROUPS size (applied after the range mapping). */
export const CAPACITY_FACTOR = 1.5;

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
const isScaled = (group: Group | undefined): group is Group => !!(group?.range || group?.capacity);

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

const scale = (group: Group, vanilla: number, rankKey: string) =>
  group.capacity ? scaleToGroup(group, group.capacity, vanilla, rankKey) : Math.round(scaleToGroup(group, group.range, vanilla, rankKey) * CAPACITY_FACTOR);

const scaleToGroup = (group: Group, range: Range | undefined, vanilla: number, rankKey: string) => {
  const [lo, hi] = range!;
  const [vLo, vHi] = vanillaExtents!.get(group)!;
  const t = vHi > vLo && !group.byRank ? (vanilla - vLo) / (vHi - vLo) : Math.max(0, RANKS.indexOf(rankKey)) / (RANKS.length - 1);
  return Math.round(lo + t * (hi - lo));
};

/** Scales every rank's MaxSpawnQuantity of a faction block in place (a full block, not a patch). */
function scaleFactionBlock(faction: Struct, group: Group) {
  for (const [rankKey, rank] of faction.SpawnSettingsPerPlayerRanks?.entries() ?? []) {
    if (rank.MaxSpawnQuantity !== undefined) rank.MaxSpawnQuantity = scale(group, rank.MaxSpawnQuantity, rankKey);
  }
}

/** The size a faction's block has in its donor lair (its own species' lair), as this file writes it. */
function homeSize(faction: string, rankKey: string): number | undefined {
  const donor = donorOf(faction);
  const vanilla = donor?.block.SpawnSettingsPerPlayerRanks?.[rankKey]?.MaxSpawnQuantity;
  if (!donor || vanilla === undefined) return undefined;
  const group = LAIR_GROUPS.find((g) => g.match(donor.lairSID));
  return isScaled(group) ? scale(group, vanilla, rankKey) : Number(vanilla);
}

/**
 * A holder gets min(lair size, its own lair size): chimeras that take a tushkan lair hold 2-6, not 30-45, and a
 * tushkan pack in a chimera lair stays at the chimera lair's size.
 */
function capAtHomeSize(faction: string, block: Struct) {
  for (const [rankKey, rank] of block.SpawnSettingsPerPlayerRanks?.entries() ?? []) {
    const home = homeSize(faction, rankKey);
    if (rank.MaxSpawnQuantity !== undefined && home !== undefined) rank.MaxSpawnQuantity = Math.min(rank.MaxSpawnQuantity, home);
  }
}

function scaleByFaction(faction: string, block: Struct) {
  const f = factionFactor(faction);
  if (f === 1) return;
  for (const [, rank] of block.SpawnSettingsPerPlayerRanks?.entries() ?? [])
    if (rank.MaxSpawnQuantity !== undefined) rank.MaxSpawnQuantity = Math.round(rank.MaxSpawnQuantity * f);
}

let once = false;

/** The open-lair faction blocks a vanilla prototype gets (openLairs.mts), sized for its group; built once each. */
const addedCache = new Map<string, Array<[string, Struct]>>();
function addedFor(base: GenericLairPrototype) {
  const key = base.__internal__.rawName;
  if (!addedCache.has(key)) {
    const group = groupOf(base);
    const added = addedFactionBlocks(base as any);
    if (isScaled(group)) added.forEach(([, block]) => scaleFactionBlock(block, group));
    added.forEach(([faction, block]) => capAtHomeSize(faction, block));
    added.forEach(([faction, block]) => scaleByFaction(faction, block));
    addedCache.set(key, added);
  }
  return addedCache.get(key)!;
}

/** A rank block of a prototype's faction (own or open-lair) as the game sees it after this file's patch. */
function finalRankBlock(sid: string, base: GenericLairPrototype, faction: string, rank: string): RankBlock | undefined {
  const added = addedFor(base).find(([key]) => key === faction)?.[1];
  if (added) {
    const block = added.SpawnSettingsPerPlayerRanks?.[rank];
    return block instanceof Struct ? { MaxSpawnQuantity: block.MaxSpawnQuantity, archetypes: block.SpawnSettingsPerArchetypes } : undefined;
  }
  const vanilla = base.Preset?.PossibleInhabitantFactions?.[faction]?.SpawnSettingsPerPlayerRanks?.[rank];
  if (!(vanilla instanceof Object)) return undefined;
  const group = groupOf(base);
  const max = vanilla.MaxSpawnQuantity;
  return {
    MaxSpawnQuantity:
      max === undefined ? undefined : Math.round((isScaled(group) ? scale(group, max, rank) : Number(max)) * factionFactor(String(vanilla.Faction ?? faction))),
    archetypes: tierArchetypes[sid]?.[faction]?.[rank as RankName] ?? vanilla.SpawnSettingsPerArchetypes,
  };
}

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
    // Region variants (regionTiers.mts) of every prototype a lair outside R1 uses, spawn-pool variants included.
    for (const sid of [...Object.keys(vanillaLairPrototypes), ...variantPrototypeSIDs]) {
      const base = vanillaOf(sid);
      if (!base) continue;
      const factions = [
        ...(base.Preset?.PossibleInhabitantFactions?.entries() ?? []).map(([key]) => String(key)),
        ...addedFor(base).map(([key]) => key),
      ];
      out.push(...regionVariants(sid, factions, (faction, rank) => finalRankBlock(sid, base, faction, rank)));
    }
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
  const added = addedFor(struct as any);
  if (!factions || (!scaled && !tiered && !added.length && !factions.entries().some(([key, f]) => factionFactor(String(f?.Faction ?? key)) !== 1))) return null;

  const fork = struct.fork();
  fork.Preset = patched(struct.Preset);
  fork.Preset.PossibleInhabitantFactions = patched(factions);

  const factored = factions.entries().some(([key, f]) => factionFactor(String(f?.Faction ?? key)) !== 1);
  if (scaled || tiered || factored) {
    for (const [factionKey, faction] of factions.entries()) {
      const ranks = faction.SpawnSettingsPerPlayerRanks;
      if (!ranks) continue;
      const tieredRanks = tiered?.[factionKey];
      const factionFork = patched(faction);
      factionFork.SpawnSettingsPerPlayerRanks = patched(ranks);
      for (const [rankKey, rank] of ranks.entries()) {
        const rankFork = patched(rank);
        const ff = factionFactor(String(faction.Faction ?? factionKey));
        if (rank.MaxSpawnQuantity !== undefined && (scaled || ff !== 1))
          rankFork.MaxSpawnQuantity = Math.round((scaled ? scale(group, rank.MaxSpawnQuantity, rankKey) : Number(rank.MaxSpawnQuantity)) * ff);
        // Without bpatch: the tier's archetype list replaces vanilla's whole.
        const archetypes = tieredRanks?.[rankKey as RankName];
        if (archetypes) rankFork.SpawnSettingsPerArchetypes = archetypes;
        factionFork.SpawnSettingsPerPlayerRanks[rankKey] = rankFork;
      }
      fork.Preset.PossibleInhabitantFactions[factionKey] = factionFork;
    }
  }
  for (const [factionKey, block] of added) {
    fork.Preset.PossibleInhabitantFactions.addNode(block, factionKey);
  }
  return fork;
}

transformGenericLairPrototypes.files = ["/GenericLairPrototypes.cfg"];
// No inheritDuplicates: it writes repeated blocks as dotted sub-struct refkeys, which the game doesn't resolve
// (see transformEnemyObjPrototypes.mts); the region variants repeat rank blocks on purpose.
