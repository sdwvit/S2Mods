import { createHash } from "node:crypto";
import { Struct } from "s2cfgtojson";
import type { MarkerPrototype, SpawnActorPrototype } from "s2cfgtojson";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";
import { lairs, TIER_COUNT as TIERS, tieredLairs, vanillaLairPrototypes } from "../LairWars/lairTiers.mts";

export const QUEST_SID = "LairMarkerTest";

/** Factions at -600 or lower towards Player in vanilla RelationPrototypes.cfg. Every mutant faction is hostile too. */
const HOSTILE_HUMANS = ["Bandits", "Militaries", "Mercenaries", "Monolith"];
const HUMANS = ["Bandits", "Neutrals", "Militaries", "Varta", "Mercenaries", "Freedom", "Monolith", "Duty", "Noon", "Scientists", "Spark", "Corpus"];
const isHostile = (faction: string) => HOSTILE_HUMANS.includes(faction) || !HUMANS.includes(faction);

/** Vanilla text keys for a faction's name: `sid_misc_answer_faction_<Faction>` (humans) or the PDA kill statistics' mutant names. */
const MUTANT_NAMES = ["Blinddog", "Bloodsucker", "Boar", "Burer", "Chimera", "Controller", "Flesh", "Poltergeist", "Pseudodog", "Pseudogiant", "Rat", "Snork", "Bayun"];
export const factionTitle = (faction: string) =>
  HUMANS.includes(faction)
    ? `sid_misc_answer_faction_${faction}`
    : MUTANT_NAMES.includes(faction)
      ? `sid_misc_statisticspack_pda_statictics_mutant_${faction.toLowerCase()}`
      : "sid_npc_name_mutant";

/** Earlier builds' region: Zalissya's, the Lesser Zone (region = nearest MarkerPrototypes region marker, as in LairTiers). */
const LEGACY_REGION = "lesser_zone";
/** The capturable Bandit camp east of Zalissya used first; its nearest region marker is another region's. */
const LEGACY_EXTRA_LAIRS = ["CCCEA3EA425A7AAF59C6A29A8CB0AB14"];

const regionMarkers = (await readFileAndGetStructs<MarkerPrototype>("MarkerPrototypes.cfg"))
  .filter((m) => m.RegionType && m.WorldPosition)
  .map((m) => ({ sid: String(m.SID), x: Number(m.WorldPosition.X), y: Number(m.WorldPosition.Y) }));
const regionOf = (x: number, y: number) =>
  regionMarkers.reduce((best, m) => (Math.hypot(m.x - x, m.y - y) < Math.hypot(best.x - x, best.y - y) ? m : best)).sid;

/**
 * LairTiers switches a vanilla lair off and one of its tier copies on (same place, own GUID), and the copy is the
 * one that gets captured: `LairTiersLair_<GUID>` records which. `lairCopySID` / `lairTierVariableSID` in
 * Mods/LairWars/lairTiers.mts (TIERS_PREFIX "LairTiers").
 */
const copySID = (lairSID: string, tier: number) =>
  tier === 0 ? lairSID : createHash("md5").update(`LairTiers:${lairSID}:T${tier}`).digest("hex").toUpperCase();
const tiered = new Set(tieredLairs.map((l) => l.sid));

export type TestLair = {
  guid: string;
  short: string;
  position: { X: number; Y: number; Z: number };
  factions: string[];
  /** Instances to ask; `tierVariable` set when LairTiers stacks copies, so only the switched-on one is asked. */
  instances: { tier: number; guid: string }[];
  tierVariable?: string;
  markerSID: string;
  markerActorGUID: string;
};

/** A letter first: s2cfgtojson renders a key that starts with digits as an array index. */
const actorGUID = (kind: string, lairSID: string) =>
  `F${createHash("md5").update(`${QUEST_SID}:${kind}:${lairSID}`).digest("hex").toUpperCase().slice(1)}`;

export type LegacyMarker = { markerSID: string; markerActorGUID: string };
/**
 * The Guide markers earlier builds showed on the hostile lairs. A save keeps a marker ShowMarker created, with its
 * own position and type, and nothing removes it (2026-10-29), so they stay defined (type None, off the map) and
 * are never spawned again.
 */
export const LEGACY_MARKERS: LegacyMarker[] = [];
export const OFF_MAP = { X: -5000000, Y: -5000000, Z: 0 };
/** Every lair LairTiers knows, the whole Zone; LairWars makes them all capturable. */
export const TEST_LAIRS: TestLair[] = [];
for (const lair of lairs) {
  const inLegacyRegion = regionOf(lair.position.X, lair.position.Y) === LEGACY_REGION || LEGACY_EXTRA_LAIRS.includes(lair.sid);
  const actor = (await readFileAndGetStructs<SpawnActorPrototype>(lair.file.slice(lair.file.indexOf("SpawnActorPrototypes/")))).find(
    (s) => s.__internal__.rawName === lair.sid,
  );
  if (inLegacyRegion && isHostile(String(actor?.InitialInhabitantFaction))) {
    LEGACY_MARKERS.push({ markerSID: `${QUEST_SID}_${lair.sid}`, markerActorGUID: actorGUID("marker", lair.sid) });
  }
  const factions = Object.keys(vanillaLairPrototypes[lair.lairPrototypeSID]?.Preset?.PossibleInhabitantFactions ?? {}).filter(
    (k) => k !== "__internal__",
  );
  const isTiered = tiered.has(lair.sid);
  TEST_LAIRS.push({
    guid: lair.sid,
    short: lair.sid.slice(0, 6),
    position: lair.position,
    factions,
    instances: Array.from({ length: isTiered ? TIERS : 1 }, (_, tier) => ({ tier, guid: copySID(lair.sid, tier) })),
    tierVariable: isTiered ? `LairTiersLair_${lair.sid}` : undefined,
    markerSID: `${QUEST_SID}_Squad_${lair.sid}`,
    markerActorGUID: actorGUID("squadmarker", lair.sid),
  });
}

export function root<T extends Struct>(sid: string, fields: Record<string, unknown>, internal: Record<string, unknown> = {}) {
  return new Struct({ __internal__: { rawName: sid, isRoot: true, ...internal }, SID: sid, ...fields }) as T;
}
