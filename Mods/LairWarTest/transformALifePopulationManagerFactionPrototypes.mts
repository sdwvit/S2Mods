import type { ALifePopulationManagerFactionPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

/** Sides under test. Both must want to expand for the war to start at all. */
const WAR_FACTIONS = ["Freedom", "Bandits"];

export const transformALifePopulationManagerFactionPrototypes: StructTransformer<
  ALifePopulationManagerFactionPrototype
> = (struct) => {
  if (!struct.Factions) return null;

  const fork = struct.fork();

  // Vanilla waits 48 in-game hours before A-Life simulation begins. Start at once.
  fork.ALifeStartSimulation = "0";
  // Re-evaluate expansion far more often than vanilla's 50.
  fork.ALifeLairExpansionTime = 5;

  // fork() yields an empty bpatch child, so only the factions we actually touch
  // are emitted. Cloning the whole Factions block would republish all 29.
  const factions = struct.Factions.fork();
  let touched = false;

  WAR_FACTIONS.forEach((name) => {
    const source = struct.Factions[name];
    if (!source) return;
    touched = true;

    // fork() so only the fields we change are emitted, not the whole faction block.
    const faction = source.fork();

    // Always take the fight when expansion offers it.
    faction.ALifeLairExpansionBattleChance = 100;

    // Make every band Aggressive so neither side settles into Normal/Defensive and stops
    // expanding. MinLairs/MaxLairs are left at vanilla on purpose: they are the *selector*
    // ranges (Aggressive 1-5, Normal 6-20, Defensive 21-900), not caps, so widening them all
    // to 1-900 made three overlapping bands and broke the lookup.
    const sourceGoals = source.ALifeFactionGoals;
    if (sourceGoals) {
      const goals = sourceGoals.fork();
      sourceGoals.entries().forEach(([goalKey]) => {
        if (!sourceGoals[goalKey]) return;
        const goal = sourceGoals[goalKey].fork();
        goal.TacticType = "EALifeFactionGoalType::Aggressive";
        goals[goalKey] = goal;
      });
      faction.ALifeFactionGoals = goals;
    }

    factions[name] = faction;
  });

  if (!touched) return null;
  fork.Factions = factions;
  return fork;
};

transformALifePopulationManagerFactionPrototypes.files = [
  "/ALifePopulationManagerFactionPrototypes.cfg",
];
