import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { FW_SIDES, fwArchetypeSID } from "./factionWarNpcs.mts";

/** One prototype serves both test lairs; the spawn actor picks the starting owner. */
export const FW_LAIR_PROTOTYPE = "LairWarTest_FWLair";

const RANKS = ["Newbie", "Experienced", "Veteran", "Master"] as const;

/** Garrison cap per side. Vanilla living spaces sit at 6-8; this is a test, so make it loud. */
const MAX_GARRISON = 100;

/** Refill fast so both camps stay manned and squads keep meeting (vanilla 180/480). */
const REFILL_SECONDS = 20;

/**
 * Wipe timeout stays LONG on purpose. The capture check in UAttachToLairStrategy
 * vetoes on any enemy within gsc.fw.NoEnemyToLairToCapture (50 m), so a wiped lair
 * must stay empty long enough for the attacker to walk in. A short wipe timer would
 * respawn the defenders and block capture outright.
 */
const WIPE_SECONDS = 600;

function rankSettings(prefix: string, roles: readonly string[]) {
  return {
    MaxSpawnQuantity: MAX_GARRISON,
    // Fill most of the cap immediately rather than trickling up from half.
    InitialSpawnQuantityPercent: 0.9,
    InitialSpawnQuantityRespawnTimeSeconds: REFILL_SECONDS,
    MaxSpawnQuantityRespawnTimeSeconds: REFILL_SECONDS,
    WipeRespawnTimeoutSeconds: WIPE_SECONDS,
    SpawnSettingsPerArchetypes: Object.fromEntries(
      roles.map((role, i) => [
        fwArchetypeSID(prefix, role),
        // One guaranteed body per side so a camp is never empty on spawn.
        { MinQuantityPerArchetype: i === 0 ? 1 : 0, SpawnWeight: 1 },
      ]),
    ),
  };
}

/**
 * A lair prototype listing both sides, whose archetypes are the FW ones. Built explicitly
 * rather than forked off BigLivingSpace so it carries no mutant inhabitants and no vanilla
 * archetypes - a lair that can spawn a non-participating archetype is a lair that stalls.
 */
export const transformLairPrototypes: StructTransformer<any> = (struct) => {
  if (String(struct.SID) !== "BigLivingSpace") return null;

  const lair = Struct.fromJson({
    SID: FW_LAIR_PROTOTYPE,
    Preset: {
      InitialInhabitantFaction: FW_SIDES[0].faction,
      IsALifePoint: true,
      PossibleInhabitantFactions: Object.fromEntries(
        FW_SIDES.map((side) => [
          side.faction,
          {
            Faction: side.faction,
            FactionPriority: 3,
            SpawnSettingsPerPlayerRanks: Object.fromEntries(
              RANKS.map((rank) => [rank, rankSettings(side.prefix, side.roles)]),
            ),
          },
        ]),
      ),
    },
  }) as unknown as Struct;

  lair.__internal__.rawName = FW_LAIR_PROTOTYPE;
  lair.__internal__.isRoot = true;
  return lair;
};

transformLairPrototypes.files = ["/GenericLairPrototypes.cfg"];
