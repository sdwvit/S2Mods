import type { Struct } from "s2cfgtojson";

/**
 * Every expansion into an occupied lair turns into a fight (vanilla 50% per faction), and the
 * population manager checks for expansions ten times as often (ALifeLairExpansionTime, vanilla 50).
 */
export const EXPANSION_BATTLE_CHANCE = 100;
export const LAIR_EXPANSION_TIME = 5;

const patched = (s: Struct) => {
  const fork = s.fork();
  fork.__internal__.bpatch = true;
  return fork;
};

export function transformALifePopulationManagerFactionPrototypes(struct: Struct) {
  if (struct.SID !== "Default") {
    return null;
  }
  const fork = struct.fork();
  fork.ALifeLairExpansionTime = `${LAIR_EXPANSION_TIME}.f`;
  fork.Factions = patched(struct.Factions);
  for (const [key, faction] of struct.Factions.entries()) {
    const factionFork = patched(faction);
    factionFork.ALifeLairExpansionBattleChance = EXPANSION_BATTLE_CHANCE;
    fork.Factions[key] = factionFork;
  }
  return fork;
}

transformALifePopulationManagerFactionPrototypes.files = ["/ALifePopulationManagerFactionPrototypes.cfg"];
