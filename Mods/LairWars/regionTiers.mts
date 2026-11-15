import { Struct, type GenericLairPrototype } from "s2cfgtojson";
import { hubLairs } from "./hubLairs.mts";
import { lairs, RANKS } from "./lairTiers.mts";
import { mutantLairs } from "./mutantLairs.mts";

/**
 * Region tiers: a lair's tier is max(player rank tier, its region's tier), so a far region spawns its higher-rank
 * enemies from the start, while lairs near Zalissya still follow the player's rank.
 *
 * - A lair belongs to the region whose centre is nearest (Living Zone Tracker places.json, kind "region").
 * - Region tier R maps onto rank block RANKS[R - 1]: R1 Newbie (no change), R2 Experienced, R3 Veteran, R4 Master.
 * - A lair outside R1 uses `<prototype>_R<n>`: it inherits its prototype (patched in the same file) and restates
 *   the rank blocks below the region's rank with that rank's block: size and enemy mix. Nested structs inherit
 *   field by field, so archetypes of the lower block that the region block lacks are restated at weight 0.
 * - Every faction block is restated: the prototype's own and the ones open lairs add (openLairs.mts), so whoever
 *   holds a far lair spawns at the region's tier.
 * - Hub lairs and guard posts stay as they are.
 *
 * Which species a new wild lair holds also follows its region tier (mutantLairs.json, precomputed). Expansion is
 * never restricted.
 */
const REGIONS: Array<{ name: string; x: number; y: number; tier: number }> = [
  { name: "Lesser Zone", x: 4024.0, y: 5789.97, tier: 1 },
  { name: "Cordon", x: 4669.97, y: 6399.97, tier: 1 },
  { name: "Garbage", x: 4054.22, y: 4329.97, tier: 1 },
  { name: "Chemical Plant", x: 2479.97, y: 5169.97, tier: 2 },
  { name: "Rostok", x: 3099.97, y: 4079.97, tier: 2 },
  { name: "Cement Factory", x: 5200.0, y: 4169.97, tier: 2 },
  { name: "Wild Island", x: 5329.97, y: 5099.97, tier: 3 },
  { name: "Burnt Forest", x: 2759.97, y: 6039.97, tier: 3 },
  { name: "Zaton", x: 6729.97, y: 6089.97, tier: 3 },
  { name: "SIRCAA", x: 6599.97, y: 4739.97, tier: 3 },
  { name: "Cooling Towers", x: 5189.97, y: 3439.97, tier: 3 },
  { name: "Yantar", x: 2149.97, y: 4039.97, tier: 3 },
  { name: "Iron Forest", x: 3799.97, y: 3309.97, tier: 3 },
  { name: "Malachite", x: 1144.97, y: 4699.97, tier: 3 },
  { name: "Swamps", x: 7579.97, y: 7249.97, tier: 4 },
  { name: "Duga", x: 1499.97, y: 6059.97, tier: 4 },
  { name: "Yaniv", x: 2139.97, y: 2869.97, tier: 4 },
  { name: "Red Forest", x: 2229.97, y: 3309.97, tier: 4 },
  { name: "Jupiter", x: 1959.97, y: 2329.97, tier: 4 },
  { name: "Pripyat", x: 2439.97, y: 1719.97, tier: 4 },
  { name: "Chornobyl NPP", x: 3899.97, y: 2799.97, tier: 4 },
  { name: "Generators", x: 3909.97, y: 2139.97, tier: 4 },
];

/** Region tier (1-4) of a world position in UE units (tracker metres x 100). */
/** The nearest of the 22 regions to a map position (UE units, cm). */
export function regionOf(x: number, y: number) {
  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(r.x * 100 - x, r.y * 100 - y);
    if (d < bestDist) [best, bestDist] = [r, d];
  }
  return best;
}

export function regionTier(x: number, y: number) {
  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(r.x * 100 - x, r.y * 100 - y);
    if (d < bestDist) [best, bestDist] = [r, d];
  }
  return best.tier;
}

export const regionPrototypeSID = (prototype: string, tier: number) => (tier > 1 ? `${prototype}_R${tier}` : prototype);

/** Lair prototype SID -> region tiers (2-4) some lair of it needs. */
const used: Record<string, Set<number>> = {};
const use = (prototype: string, tier: number) => {
  if (tier > 1) (used[prototype] ??= new Set()).add(tier);
  return regionPrototypeSID(prototype, tier);
};

/** Vanilla lair SID -> its region prototype (only lairs outside R1 and outside hubs). */
export const regionLairPrototype: Record<string, string> = {};
for (const lair of lairs) {
  if (hubLairs.has(lair.sid)) continue;
  const tier = regionTier(lair.position.X, lair.position.Y);
  if (tier > 1) regionLairPrototype[lair.sid] = use(lair.lairPrototypeSID, tier);
}
/** Region prototype of each new wild lair, in mutantLairs order. */
export const mutantLairPrototypes = mutantLairs.map((l) => use(l.owner, regionTier(l.x, l.y)));

/** Region tier counts, for the build log. */
export const regionTierCounts = {
  vanilla: lairs.filter((l) => !hubLairs.has(l.sid)).map((l) => regionTier(l.position.X, l.position.Y)),
  added: mutantLairs.map((l) => regionTier(l.x, l.y)),
};

/** Final rank block of one faction of a lair prototype (vanilla merged with the mod's patch). */
export type RankBlock = { MaxSpawnQuantity?: number; archetypes?: Struct };

/**
 * The region variants of a prototype. `blockOf(faction, rank)` gives the patched rank block, `factions` the
 * prototype's own faction keys.
 */
export function regionVariants(prototype: string, factions: string[], blockOf: (faction: string, rank: string) => RankBlock | undefined) {
  return [...(used[prototype] ?? [])].sort().map((tier) => {
    const regionRank = RANKS[tier - 1];
    const sid = regionPrototypeSID(prototype, tier);
    const factionsStruct = new Struct();
    for (const faction of factions) {
      const top = blockOf(faction, regionRank);
      if (!top) continue;
      const ranks = new Struct();
      for (const rank of RANKS.slice(0, tier - 1)) {
        const low = blockOf(faction, rank);
        if (!low) continue;
        const block = new Struct();
        if (top.MaxSpawnQuantity !== undefined) block.MaxSpawnQuantity = top.MaxSpawnQuantity;
        if (top.archetypes) {
          const list = new Struct();
          top.archetypes.forEach(([key, value]) =>
            list.addNode(
              new Struct({ MinQuantityPerArchetype: (value as any).MinQuantityPerArchetype ?? 0, SpawnWeight: (value as any).SpawnWeight ?? 0 }),
              key,
            ),
          );
          low.archetypes?.forEach(([key]) => {
            if (list[key as string] === undefined)
              list.addNode(new Struct({ MinQuantityPerArchetype: 0, SpawnWeight: 0 }), key);
          });
          block.SpawnSettingsPerArchetypes = list;
        }
        ranks.addNode(block, rank);
      }
      if (ranks.entries().length) factionsStruct.addNode(new Struct({ SpawnSettingsPerPlayerRanks: ranks }), faction);
    }
    const variant = new Struct({ SID: sid }) as GenericLairPrototype;
    Object.assign(variant.__internal__, { rawName: sid, isRoot: true, refkey: prototype });
    variant.Preset = new Struct({ PossibleInhabitantFactions: factionsStruct }) as any;
    return variant;
  });
}
