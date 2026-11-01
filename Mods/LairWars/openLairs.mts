import type { GenericLairPrototype } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import { readFileAndGetStructs } from "../../src/read-file-and-get-structs.mts";
import { isGuardLairPrototype } from "./hubLairs.mts";

/**
 * Open lairs: every lair prototype outside the hubs lists every faction the A-Life population manager expands
 * with (`ALifePopulationManagerFactionPrototypes`, Default.Factions) in `PossibleInhabitantFactions`, so any
 * faction or mutant species can move into any lair. Vanilla lists only the lair's own faction in most of them
 * (a Militaries camp: Militaries; a Blinddog lair: Blinddog), and expansion only targets a lair that lists the
 * expanding faction.
 *
 * Left as vanilla: `Guard*` (hub guards), the hub scientists (SIRCAA, Malachite) and resting lairs
 * (`ELairType::RestingLair`: rest stops for passing squads, no inhabitants of their own).
 *
 * An added faction inherits its block from a donor lair where that faction lives (`DONOR_OVERRIDES`, else the
 * prototype named after it, else the first one that lists it) through a nested refkey
 * (`Bandits.Preset.PossibleInhabitantFactions.Bandits`): the donor's block as patched in the same file, tiers
 * included. It restates only the per-rank `MaxSpawnQuantity` of the lair's starting faction, so a lair keeps its
 * size whoever holds it. A placed lair still starts with its `InitialInhabitantFaction` only.
 */
const HUB_SCIENTIST_PROTOTYPES = new Set(["SIRCAA_Scientists", "MALACHITE_Scientists"]);
const DONOR_OVERRIDES: Record<string, string> = { Zombie: "NeutralZombies" };

type FactionBlock = Struct & { Faction: string; SpawnSettingsPerPlayerRanks?: Struct };

type Donor = { lairSID: string; key: string; block: FactionBlock };

const vanillaLairs = await readFileAndGetStructs<GenericLairPrototype>("LairPrototypes/GenericLairPrototypes.cfg");
const vanillaLairBySID = Object.fromEntries(vanillaLairs.map((s) => [s.__internal__.rawName, s]));

const population = (await readFileAndGetStructs<Struct>("ALifePopulationManagerFactionPrototypes.cfg")).find(
  (s) => s.SID === "Default",
);
export const EXPANDING_FACTIONS: string[] = (population?.Factions?.entries() ?? []).map(([, f]) => String(f.Faction));

const isOpenLairPrototype = (lair: GenericLairPrototype) => {
  const sid = lair.__internal__.rawName;
  return (
    !isGuardLairPrototype(sid) &&
    !HUB_SCIENTIST_PROTOTYPES.has(sid) &&
    String(lair.Preset?.LairType) !== "ELairType::RestingLair" &&
    !!lair.Preset?.PossibleInhabitantFactions
  );
};

const factionEntries = (lair: GenericLairPrototype) =>
  (lair.Preset?.PossibleInhabitantFactions?.entries() ?? []).map(([key, block]) => [String(key), block as FactionBlock] as const);

function donorIn(lair: GenericLairPrototype | undefined, faction: string): Donor | undefined {
  const entry = lair && factionEntries(lair).find(([, block]) => String(block.Faction) === faction);
  return entry && { lairSID: lair.__internal__.rawName, key: entry[0], block: entry[1] };
}

const donors: Record<string, Donor> = {};
for (const faction of EXPANDING_FACTIONS) {
  const donor =
    donorIn(vanillaLairBySID[DONOR_OVERRIDES[faction]], faction) ??
    donorIn(vanillaLairBySID[faction], faction) ??
    vanillaLairs.filter(isOpenLairPrototype).map((lair) => donorIn(lair, faction)).find(Boolean);
  if (donor) donors[faction] = donor;
}

/**
 * Faction blocks a lair prototype lacks (none for hub, guard and resting lairs): each inherits its donor's
 * block and restates the lair's own MaxSpawnQuantity per player rank.
 */
export function addedFactionBlocks(lair: GenericLairPrototype): Array<[string, FactionBlock]> {
  if (!isOpenLairPrototype(lair)) return [];
  const own = factionEntries(lair).map(([, block]) => block);
  const listed = new Set(own.map((block) => String(block.Faction)));
  const sizeOf = own.find((block) => String(block.Faction) === String(lair.Preset.InitialInhabitantFaction)) ?? own[0];
  return EXPANDING_FACTIONS.filter((faction) => !listed.has(faction) && donors[faction]).map((faction) => {
    const ranks = new Struct();
    donors[faction].block.SpawnSettingsPerPlayerRanks?.forEach(([rank]) => {
      const size = sizeOf?.SpawnSettingsPerPlayerRanks?.[rank]?.MaxSpawnQuantity;
      if (size !== undefined) ranks.addNode(new Struct({ MaxSpawnQuantity: size }), rank);
    });
    const block = new Struct({ SpawnSettingsPerPlayerRanks: ranks }) as FactionBlock;
    const { lairSID, key } = donors[faction];
    block.__internal__.refkey = `${lairSID}.Preset.PossibleInhabitantFactions.${key}`;
    return [faction, block];
  });
}
