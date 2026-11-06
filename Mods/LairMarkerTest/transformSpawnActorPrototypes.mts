import type { SpawnActorPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { LEGACY_MARKERS, OFF_MAP, root, TEST_LAIRS } from "./lairMarker.mts";

let once = false;

const markerActor = (guid: string, markerSID: string, position: { X: number; Y: number; Z: number }) =>
  root<SpawnActorPrototype>(guid, {
    SpawnOnStart: false,
    PositionX: position.X,
    PositionY: position.Y,
    PositionZ: position.Z,
    RotatorAngleYaw: 0,
    RotatorAnglePitch: 0,
    RotatorAngleRoll: 0,
    ScaleX: 1,
    ScaleY: 1,
    ScaleZ: 1,
    DLC: "None",
    LevelName: "WorldMap_WP",
    PlaceholderMapPath: "/Game/_Stalker_2/maps/_Stalker2_WorldMap/WorldMap_WP",
    SpawnedPrototypeSID: markerSID,
    SpawnType: "ESpawnType::Marker",
  });

/**
 * Marker spawn actors like the Zalissya bar's (4B56C325...), without a map placeholder. The quest spawns the test
 * lairs' ones; the legacy ones stay defined and are never spawned.
 */
export const transformSpawnActorPrototypes: StructTransformer<SpawnActorPrototype> = () => {
  if (once) return null;
  once = true;
  return [
    ...LEGACY_MARKERS.map((m) => markerActor(m.markerActorGUID, m.markerSID, OFF_MAP)),
    ...TEST_LAIRS.map((lair) => markerActor(lair.markerActorGUID, lair.markerSID, lair.position)),
  ];
};

transformSpawnActorPrototypes.files = ["/SpawnActorPrototypes/WorldMap_WP/4B56C32544C5470C2D7DFD89F59BBB8F.cfg"];
