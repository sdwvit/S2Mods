import { Struct } from "s2cfgtojson";

/**
 * The base game ships no faction-war data at all — `bParticipatesInFactionWar` and every
 * `ESpawnType::FactionWar` actor live only in DLC1. An NPC is eligible for the war only if its
 * needs preset sets that flag, so vanilla Freedom/Bandit archetypes can never be dispatched as
 * war squads no matter what the controller says. DLC1's chain is:
 *
 *   lair prototype -> SpawnSettingsPerArchetypes -> FW_<Faction>_<Role>
 *     -> NeedsPresetSID = FW_<Faction>sNeedsPreset -> bParticipatesInFactionWar = true
 *
 * This file rebuilds that chain on top of base-game parents. Unlike DLC1 and ZoneWar we do NOT
 * derive new `FW_` *factions*: Freedom and Bandits are already Enemy (-800) in vanilla, so there
 * is nothing to toggle, and an underived faction cannot hit the "invalid OwningFactionIdx" crash.
 */

/** Exact role lists. Naming a role that does not exist is a silent spawn failure. */
export const FW_SIDES = [
  {
    faction: "Freedom",
    prefix: "Freedom",
    needsPreset: "FreedomsNeedsPreset",
    roles: ["CloseCombat", "Recon", "Sniper", "Stormtrooper"],
  },
  {
    faction: "Bandits",
    prefix: "Bandit",
    needsPreset: "BanditsNeedsPreset",
    roles: ["CloseCombat", "Heavy", "Recon", "Stormtrooper"],
  },
] as const;

export const fwNeedsPresetSID = (prefix: string) => `LairWarTest_FW_${prefix}NeedsPreset`;
export const fwArchetypeSID = (prefix: string, role: string) => `LairWarTest_FW_${prefix}_${role}`;

/** Base-game sensor DLC1 puts on every faction-war NPC. */
const FW_HEARING_SENSOR = "HumanFWHearingSensor";

function inherit(sid: string, refkey: string, fields: Record<string, unknown>): Struct {
  const s = Struct.fromJson({ SID: sid, ...fields }) as unknown as Struct;
  s.__internal__.rawName = sid;
  s.__internal__.isRoot = true;
  // Same vanilla file as the parent, so a bare refkey - no refurl. See s2-struct-transformers.
  s.__internal__.refkey = refkey;
  delete (s.__internal__ as { refurl?: string }).refurl;
  return s;
}

/** The whole point: the eligibility flag, inherited from each faction's vanilla preset. */
export function fwNeedsPresets(): Struct[] {
  return FW_SIDES.map((side) =>
    inherit(fwNeedsPresetSID(side.prefix), side.needsPreset, {
      bParticipatesInFactionWar: true,
    }),
  );
}

/** One archetype per vanilla role, repointed at the FW needs preset and hearing sensor. */
export function fwArchetypes(): Struct[] {
  return FW_SIDES.flatMap((side) =>
    side.roles.map((role) =>
      inherit(fwArchetypeSID(side.prefix, role), `GeneralNPC_${side.prefix}_${role}`, {
        Faction: side.faction,
        NeedsPresetSID: fwNeedsPresetSID(side.prefix),
        HearingSensorPrototypeSID: FW_HEARING_SENSOR,
      }),
    ),
  );
}
