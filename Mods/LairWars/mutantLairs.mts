import { createHash } from "node:crypto";
import fs from "node:fs";
import type { SpawnActorPrototype } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";

/**
 * Mutant lairs the mod adds to the map (`mutantLairs.json`): owner lair prototype, its faction and the position in
 * UE units. The placement is precomputed; these rules produced it:
 *
 * Owners
 * - One lair per species of each GAMMA mutant lair (Anomaly 1.5.3 smart terrains where only mutants respawn), mapped
 *   to S2 prototypes; a lair with no known species gets WildField. No lair is dropped: if no spot is free nearby, the
 *   search widens until one is.
 *
 * Spots
 * - Open-world contextual-action spots, item piles, items and containers; z = that spot.
 * - Where none is free: a 20 m grid point, z = the median height of the ground objects within 80 m. It needs an
 *   object that never floats (NPC spot, body, item, container) within 40 m: water and closed-off ground have none.
 * - Item spots and grid points stay off water (40%+ water-dark pixels within about 12 m on the map picture).
 *
 * Distances
 * - From other new lairs: 35 m + a random 0-50 m per lair (fixed per lair); two lairs keep the mean of their two.
 *   Only if nothing else is free: 35 m (3 lairs).
 * - Boss lairs (controller, burer, poltergeist, pseudogiant, chimera): 300 m from every other boss lair, new or
 *   vanilla.
 * - 30 m from any vanilla lair, 50 m from human lairs.
 * - 10 m from anomalies; 30 m from flashbang, lightning-ball and fireball anomalies; psy anomalies are ignored
 *   (they spare mutants); radiation is ignored.
 *
 * Kept out of
 * - Hubs: a circle around each hub's guard and resident lairs, + 100 m.
 * - Human bases: 3+ human lairs within 200 m of each other, a circle around them + 50 m.
 * - SIRCAA's walled grounds, + 10 m; the far-west military base.
 * - Underground: 10 m+ below the surrounding surface (75th-percentile height 60-250 m around), the Lesser Zone
 *   transport tunnel (+150 m), 60 m around named tunnels.
 * - Debug areas: 800 m+ from every named location.
 *
 * Empty areas
 * - Areas marked empty on the tracker map get about the map's average lair density (at least 1), spread across the
 *   area; the lairs moved in are the nearest by source, boss lairs never.
 *
 * Species and habitat
 * - Fewer poltergeists and bayuns: the 7 worst-placed poltergeist lairs became snorks, the 20 worst-placed bayun
 *   lairs blind dogs.
 * - Each place gets a kind (village/farm, town, industrial, military, lab, wild: the nearest named location within
 *   250 m, else wild), an indoor score (household objects within 30 m) and a water share. Species fit: bayuns,
 *   poltergeists, controllers and burers in buildings and settlements; zombies, snorks, tushkans and bloodsuckers
 *   near buildings (bloodsuckers also by water); fleshes on farms and fields; boars, dogs and WildField in the wild
 *   (boars near water); chimeras and pseudogiants deep in the wild. A lair that fits badly swaps owners with a lair
 *   within 1 km when both fit better (bosses keep 300 m).
 * - Species by region tier (regionTiers.mts; species tiers from BetterQuestRewards' reward per enemy:
 *   S1 tushkan, flesh, blind dog, boar, zombie; S2 snork, bayun, pseudodog; S3 burer, poltergeist, bloodsucker,
 *   controller; S4 deer, pseudogiant, chimera). R1 70% S1, 30% S2. R2 50% S1, 38% S2, 12% S3. R3 60% S2, 30% S3,
 *   10% S4. R4 45% S2, 30% S3, 25% S4. Lairs whose species fits keep it (best habitat fit first); the rest are
 *   re-picked by habitat fit, inside a tier at shares snork .55 / pseudodog .3 / bayun .15, bloodsucker .4 /
 *   controller and burer .22 / poltergeist .16, chimera and pseudogiant .4 / deer .2, no species above 1.3x its
 *   share while another fits. Boss spacing caps S3 and S4: where no boss fits, bloodsuckers and deer, else S2.
 *   Hand edits and WildField lairs keep their species.
 * - Then half the pseudodog and bayun lairs (worst habitat fit first) became S1 where the region allows it (best
 *   fit, least common first), else snorks: 139 -> 69 pseudodogs, 79 -> 39 bayuns.
 *
 * Hand edits (applied to the lair nearest each position)
 * - 7239, 5380 m: a controller lair, with a zombie lair 25 m away at 7253, 5359 m; boss lairs within 300 m of it
 *   became snorks.
 * - 7602, 5767 m: zombies; 7275, 5685 m: boars (swapped).
 *
 * Each lair becomes three cfg-only spawn actors shaped like a median vanilla mutant lair: the lair spawner, a core
 * volume (where it spawns) and a territory volume. SIDs come from `seed`: the lair's owner and position when it was
 * first placed, kept when its species changes (422 owners changed since), so saves keep the same lairs.
 */
/** `seed`: the SID seed. It keeps the lair's first owner, so a lair whose species changed keeps its SID. */
type MutantLair = { owner: string; faction: string; x: number; y: number; z: number; seed: string };

/**
 * Bump whenever an added lair's spawner changes (owner, prototype, position): saves delete a spawned actor whose
 * applied-mod version differs and spawn it again from the new prototype, so it never duplicates and never keeps a
 * stale species. Version 1: region prototypes and species by region (saves from before had no version).
 * Version 2: half the pseudodog and bayun lairs changed species.
 */
const ADDED_LAIR_VERSION = 2;

/** Median vanilla mutant lair: spawner about 7 m over the ground, core volume just above it. */
const LAIR_ABOVE_GROUND = 700;
const CORE = { above: 150, scale: [470, 530, 200] };
const TERRITORY = { above: 300, scale: [3500, 3200, 600] };

const guid = (seed: string) => createHash("md5").update(`LairWars_${seed}`).digest("hex").toUpperCase();

const listStruct = (values: string[]) => {
  const s = new Struct();
  values.forEach((v, i) => s.addNode(v, i));
  s.__internal__.isArray = true;
  return s;
};

const actor = (sid: string, x: number, y: number, z: number, fields: Record<string, unknown>) =>
  new Struct({
    __internal__: { rawName: sid, isRoot: true },
    SID: sid,
    SpawnOnStart: false,
    PositionX: x,
    PositionY: y,
    PositionZ: z,
    RotatorAngleYaw: 0,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    ...fields,
  }) as SpawnActorPrototype;

const volume = (sid: string, x: number, y: number, z: number, scale: number[]) =>
  actor(sid, x, y, z, {
    ScaleX: scale[0],
    ScaleY: scale[1],
    ScaleZ: scale[2],
    SpawnType: "ESpawnType::Trigger",
    TriggerShape: "ETriggerShape::Box",
  });

export const mutantLairs: MutantLair[] = JSON.parse(fs.readFileSync(new URL("./mutantLairs.json", import.meta.url), "utf8"));

/** Spawn actors of every added lair: spawner, core volume, territory volume. `prototypes`: lair prototype per lair. */
export function mutantLairActors(prototypes: string[]): SpawnActorPrototype[] {
  return mutantLairs.flatMap(({ faction, x, y, z, seed }, i) => {
    const core = guid(`${seed}_Core`);
    const territory = guid(`${seed}_Territory`);
    const spawner = actor(guid(seed), x, y, z + LAIR_ABOVE_GROUND, {
      SpawnOnStart: true,
      DLC: "BaseGame",
      SpawnedPrototypeSID: prototypes[i],
      SpawnType: "ESpawnType::LairSpawner",
      LairPrototypeSID: prototypes[i],
      LairType: "ELairType::ALifeLair",
      CanBeCaptured: true,
      CanAttack: true,
      CanDefend: true,
      InitialInhabitantFaction: faction,
      ActiveLair: true,
      AllowSpawnInShelter: false,
      LairPreferredSpawnType: "ELairPreferredSpawnType::CoreVolume",
      Volumes: new Struct({
        LairCoreVolumes: listStruct([core]),
        LairTerritoryVolumes: listStruct([territory]),
      }),
      RestrictionRadius: 60000,
      bRestrictorVolumeEnabled: false,
      MaxSpawnRank: "ERank::Master",
      MinSpawnRank: "ERank::Newbie",
      NodePrototypeAppliedMods: new Struct({
        __internal__: { bpatch: true },
        LairWars: new Struct({ NodePrototypeModVersion: ADDED_LAIR_VERSION }),
      }),
    });
    return [spawner, volume(core, x, y, z + CORE.above, CORE.scale), volume(territory, x, y, z + TERRITORY.above, TERRITORY.scale)];
  });
}
