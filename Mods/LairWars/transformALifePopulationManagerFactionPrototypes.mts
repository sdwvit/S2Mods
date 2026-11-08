import type { Struct } from "s2cfgtojson";

/**
 * Every expansion into an occupied lair turns into a fight (vanilla 50% per faction), and the
 * population manager checks for expansions ten times as often (ALifeLairExpansionTime, vanilla 50).
 */
export const EXPANSION_BATTLE_CHANCE = 100;
export const LAIR_EXPANSION_TIME = 5;
/**
 * Vanilla turns a faction Defensive once it holds 8-32 lairs (per faction), which stops a winning faction from expanding.
 * Normal now runs up to 899 lairs and Defensive starts at 900 (vanilla MaxLairs; the Zone has ~450 lairs), so it never kicks in.
 */
export const DEFENSIVE_MIN_LAIRS = 900;

function removeDefensiveBrake(goals: Struct | undefined) {
  if (!goals) return undefined;
  const goalsFork = patched(goals);
  let changed = false;
  for (const [key, goal] of goals.entries()) {
    const tactic = String(goal.TacticType);
    if (tactic.endsWith("::Normal")) {
      const goalFork = patched(goal);
      goalFork.MaxLairs = DEFENSIVE_MIN_LAIRS - 1;
      goalsFork[key] = goalFork;
      changed = true;
    } else if (tactic.endsWith("::Defensive")) {
      const goalFork = patched(goal);
      goalFork.MinLairs = DEFENSIVE_MIN_LAIRS;
      goalsFork[key] = goalFork;
      changed = true;
    }
  }
  return changed ? goalsFork : undefined;
}

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
    const goals = removeDefensiveBrake(faction.ALifeFactionGoals);
    if (goals) factionFork.ALifeFactionGoals = goals;
    fork.Factions[key] = factionFork;
  }
  return fork;
}

transformALifePopulationManagerFactionPrototypes.files = ["/ALifePopulationManagerFactionPrototypes.cfg"];
transformALifePopulationManagerFactionPrototypes.inheritDuplicates = true;
