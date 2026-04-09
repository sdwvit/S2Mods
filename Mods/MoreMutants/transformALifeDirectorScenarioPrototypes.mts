import type { ALifeDirectorScenarioPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

const FACTOR = 2;

const MUTANT_PREFIXES = ["Mutant", "Blinddog", "Boar", "Flesh", "Rat", "Tushkan", "Bloodsucker", "Snork", "Cat", "Chimera"];

function isMutantScenario(key: string) {
  return MUTANT_PREFIXES.some((p) => key.startsWith(p)) || key.includes("Mutant");
}

export const transformALifeDirectorScenarioPrototypes: StructTransformer<ALifeDirectorScenarioPrototype> = async (struct, {}) => {
  const newStruct = struct.fork();

  const Scenarios = struct.Scenarios.map(([key, scenario]) => {
    if (!isMutantScenario(key)) return;

    const scenarioFork = scenario.fork();

    if (scenario.ExpansionSquadNumMax) scenarioFork.ExpansionSquadNumMax = scenario.ExpansionSquadNumMax * FACTOR;
    if (scenario.ScenarioWeight) scenarioFork.ScenarioWeight = scenario.ScenarioWeight * FACTOR;

    scenarioFork.ScenarioSquads = scenario.ScenarioSquads.map(([_, squad]) => {
      const squadFork = squad.fork();
      if (squad.AliveMultiplierMax) squadFork.AliveMultiplierMax = squad.AliveMultiplierMax * FACTOR;
      return squadFork;
    });
    scenarioFork.ScenarioSquads.__internal__.useAsterisk = false;

    return scenarioFork;
  });
  Scenarios.__internal__.useAsterisk = false;

  Object.assign(newStruct, { Scenarios });

  return newStruct.fork(true);
};

transformALifeDirectorScenarioPrototypes.files = ["/ALifeDirectorScenarioPrototypes.cfg"];
