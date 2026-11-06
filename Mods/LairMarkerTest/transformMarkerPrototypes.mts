import type { MarkerPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { LEGACY_MARKERS, OFF_MAP, root, TEST_LAIRS } from "./lairMarker.mts";

let once = false;

const marker = (sid: string, MarkType: string, position: { X: number; Y: number; Z: number }) =>
  root<MarkerPrototype>(
    sid,
    {
      MarkType,
      MarkerRadius: 2500,
      InitDiscoverState: "EMarkerState::Explored",
      Title: sid,
      Description: "Empty",
      WorldPosition: { ...position },
      MarkerRevealDistance: 13000,
      MarkerExploreDistance: 2500,
    },
    { refkey: "[0]" },
  );

/**
 * A squad leader marker per test lair, created by the quest's Spawn node so a Despawn can remove it (ShowMarker
 * creates a marker nothing removes, 2026-10-29). Its cfg Title isn't displayed; the quest's SetLocationName names
 * the owner. The legacy markers stay defined, type None and off the map.
 */
export const transformMarkerPrototypes: StructTransformer<MarkerPrototype> = () => {
  if (once) return null;
  once = true;
  return [
    ...LEGACY_MARKERS.map((m) => marker(m.markerSID, "EMarkerType::None", OFF_MAP)),
    ...TEST_LAIRS.map((lair) => marker(lair.markerSID, "EMarkerType::PartyLeader", lair.position)),
  ];
};

transformMarkerPrototypes.files = ["/MarkerPrototypes.cfg"];
