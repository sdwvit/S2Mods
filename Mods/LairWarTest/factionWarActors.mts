import { Struct } from "s2cfgtojson";

/** Lair actor GUIDs under test (vanilla, CanBeCaptured=true, multi-faction prototypes). */
/**
 * Both sit ~0.05 km from the Rostok fast-travel point, 69 m apart, 0.7 m elevation delta.
 * Both are `Freedom` lair prototypes: human camps, ELairType::ALifeLair, ActiveLair, CoreVolume
 * spawn, Newbie-Master rank, CanAttack already true in vanilla.
 *
 * 69 m matters: gsc.fw.NoEnemyToLairToCapture vetoes capture on any enemy within 50 m, so a
 * closer pair would deadlock with each garrison blocking the other's capture.
 */
export const LAIR_FREEDOM = "CB58606D44997ADDE6E19F9EF76833FC";
export const LAIR_BANDITS = "34682CFA49A888D1309F66BD32AEA3F6";

export const WAR_PRESET = "War_LairTest";

/**
 * Every spawn actor the engine instantiates carries this. Without it the actor
 * prototype is parsed but never placed in the world, so a FactionWar controller
 * referenced by `FactionWarPlaceholder` simply does not exist at runtime and
 * FWChangePreset silently no-ops. Vanilla, DLC1 and ZoneWar all set it.
 */
const PLACEHOLDER_MAP_PATH = "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP";

const POS_FREEDOM = { x: 321442, y: 413048, z: 752 };
const POS_BANDITS = { x: 323474, y: 406447, z: 682 };

/** New actor GUIDs invented for this mod (hex, no vanilla collisions). */
export const GUID = {
  controller: "A11EDA5E4F0000000000000000000001",
  spawnerFreedom: "A11EDA5E4F0000000000000000000002",
  spawnerBandits: "A11EDA5E4F0000000000000000000003",
  reinforcerFreedom: "A11EDA5E4F0000000000000000000004",
  reinforcerBandits: "A11EDA5E4F0000000000000000000005",
};

function root(sid: string, fields: Record<string, unknown>): Struct {
  const s = Struct.fromJson({ SID: sid, ...fields }) as unknown as Struct;
  s.__internal__.rawName = sid;
  s.__internal__.isRoot = true;
  return s;
}

/** Three spawn points fanned out ~20 m from the lair, mirroring the DLC's spacing. */
function spawnLocations(p: { x: number; y: number; z: number }) {
  return [
    `X=${p.x + 1200}.000 Y=${p.y}.000 Z=${p.z}.000`,
    `X=${p.x - 1200}.000 Y=${p.y + 800}.000 Z=${p.z}.000`,
    `X=${p.x}.000 Y=${p.y - 1400}.000 Z=${p.z}.000`,
  ];
}

function unitSpawner(sid: string, faction: string, lair: string, p: typeof POS_FREEDOM) {
  return root(sid, {
    SpawnOnStart: true,
    PositionX: p.x,
    PositionY: p.y,
    PositionZ: p.z,
    RotatorAngleYaw: 0,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: PLACEHOLDER_MAP_PATH,
    SpawnType: "ESpawnType::UnitSpawner",
    OwningFaction: faction,
    SpawnedSquadSize: 12,
    Lair: lair,
    SpawnLocations: spawnLocations(p),
  });
}

function reinforcer(sid: string, faction: string, targetLair: string, p: typeof POS_FREEDOM) {
  return root(sid, {
    SpawnOnStart: true,
    PositionX: p.x,
    PositionY: p.y,
    PositionZ: p.z,
    RotatorAngleYaw: 0,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: PLACEHOLDER_MAP_PATH,
    SpawnType: "ESpawnType::Reinforcer",
    OwningFaction: faction,
    DefendersCount: 20,
    MinReinforcementSquadSize: 6,
    MaxReinforcementSquadSize: 12,
    ReinforcePriority: 0,
    TargetLair: targetLair,
  });
}

/**
 * Per-faction war params. MinTimerForAttack/MaxTimerForAttack are the dispatch
 * clock: the DLC's `Off` preset zeroes them and its `War_*` presets set 30/45.
 * Non-zero here is what actually sends attack squads.
 */
function factionParams(faction: string) {
  return {
    Faction: faction,
    MinTimerForAttack: 20,
    MaxTimerForAttack: 30,
    MinSpawnCooldown: 15,
    MaxSpawnCooldown: 25,
    MinReinforceCooldown: 30,
    MaxReinforceCooldown: 45,
    MinAttackSquadSize: 8,
    MaxAttackSquadSize: 16,
    bRefillEnabled: true,
  };
}

/** Zeroed timers = nobody attacks. The DLC's `Off` preset looks exactly like this. */
function idleParams(faction: string) {
  return { ...factionParams(faction), MinTimerForAttack: 0, MaxTimerForAttack: 0, bRefillEnabled: false };
}

/**
 * The controller. Mirrors the DLC: an inert `Off` preset plus an active war
 * preset. Nothing dispatches until a quest node switches to the war preset —
 * see transformRootgraph.mts.
 */
function controller() {
  return root(GUID.controller, {
    SpawnOnStart: true,
    PositionX: Math.round((POS_FREEDOM.x + POS_BANDITS.x) / 2),
    PositionY: Math.round((POS_FREEDOM.y + POS_BANDITS.y) / 2),
    PositionZ: Math.round((POS_FREEDOM.z + POS_BANDITS.z) / 2),
    RotatorAngleYaw: 0,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: PLACEHOLDER_MAP_PATH,
    SpawnType: "ESpawnType::FactionWar",
    UnitSpawners: [GUID.spawnerFreedom, GUID.spawnerBandits],
    Reinforcers: [GUID.reinforcerFreedom, GUID.reinforcerBandits],
    FactionsPresets: {
      Off: {
        bSpawnLairMarkers: false,
        FactionsParams: [idleParams("Freedom"), idleParams("Bandits")],
      },
      [WAR_PRESET]: {
        // The four EMarkerType::FactionWar* prototypes the engine drives off this flag are
        // declared in DLC1's MarkerPrototypes.cfg and do not exist in the base game, so it
        // stays off to keep this mod DLC-free. Flip to true if you own DLC1 and want the
        // attack/defend map markers.
        bSpawnLairMarkers: false,
        FactionsParams: [factionParams("Freedom"), factionParams("Bandits")],
      },
    },
  });
}

/** All five new actors, emitted once. */
export function factionWarActors(): Struct[] {
  return [
    unitSpawner(GUID.spawnerFreedom, "Freedom", LAIR_FREEDOM, POS_FREEDOM),
    unitSpawner(GUID.spawnerBandits, "Bandits", LAIR_BANDITS, POS_BANDITS),
    reinforcer(GUID.reinforcerFreedom, "Freedom", LAIR_FREEDOM, POS_FREEDOM),
    reinforcer(GUID.reinforcerBandits, "Bandits", LAIR_BANDITS, POS_BANDITS),
    controller(),
  ];
}
