import type { ALifeDirectorScenarioPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

const FACTOR = 2;

export const transformALifeDirectorScenarioPrototypes: StructTransformer<ALifeDirectorScenarioPrototype> = async (struct, {}) => {
  const newStruct = struct.fork();

  // Double squad sizes in all Scenarios
  const Scenarios = struct.Scenarios.map(([_, scenario]) => {
    const scenarioFork = scenario.fork();

    if (scenario.ExpansionSquadNumMin) scenarioFork.ExpansionSquadNumMin = scenario.ExpansionSquadNumMin * FACTOR;
    if (scenario.ExpansionSquadNumMax) scenarioFork.ExpansionSquadNumMax = scenario.ExpansionSquadNumMax * FACTOR;

    scenarioFork.ScenarioSquads = scenario.ScenarioSquads.map(([_, squad]) => {
      const squadFork = squad.fork();
      if (squad.AliveMultiplierMin) squadFork.AliveMultiplierMin = squad.AliveMultiplierMin * FACTOR;
      if (squad.AliveMultiplierMax) squadFork.AliveMultiplierMax = squad.AliveMultiplierMax * FACTOR;
      return squadFork;
    });
    scenarioFork.ScenarioSquads.__internal__.useAsterisk = false;

    return scenarioFork;
  });
  Scenarios.__internal__.useAsterisk = false;

  // Halve spawn delays in all ScenarioGroups
  const ScenarioGroups = struct.ScenarioGroups.map(([_, v]) => {
    const fork = v.fork();
    if (v.SpawnDelayMin) fork.SpawnDelayMin = Math.ceil(v.SpawnDelayMin / FACTOR);
    if (v.SpawnDelayMax) fork.SpawnDelayMax = Math.ceil(v.SpawnDelayMax / FACTOR);
    if (v.PostSpawnDirectorTimeoutMin) fork.PostSpawnDirectorTimeoutMin = Math.ceil(v.PostSpawnDirectorTimeoutMin / FACTOR);
    if (v.PostSpawnDirectorTimeoutMax) fork.PostSpawnDirectorTimeoutMax = Math.ceil(v.PostSpawnDirectorTimeoutMax / FACTOR);
    if (fork.entries().length) {
      return fork;
    }
  });
  ScenarioGroups.__internal__.useAsterisk = false;

  Object.assign(newStruct, {
    Scenarios,
    ScenarioGroups,
    DefaultExpansionSquadNumMin: struct.DefaultExpansionSquadNumMin * FACTOR,
    DefaultExpansionSquadNumMax: struct.DefaultExpansionSquadNumMax * FACTOR,
    DefaultSpawnDelayMin: Math.ceil(struct.DefaultSpawnDelayMin / FACTOR),
    DefaultSpawnDelayMax: Math.ceil(struct.DefaultSpawnDelayMax / FACTOR),
    DefaultPostSpawnDirectorTimeoutMin: Math.ceil(struct.DefaultPostSpawnDirectorTimeoutMin / FACTOR),
    DefaultPostSpawnDirectorTimeoutMax: Math.ceil(struct.DefaultPostSpawnDirectorTimeoutMax / FACTOR),
    DefaultALifeLairExpansionToPlayerTimeMin: Math.ceil(struct.DefaultALifeLairExpansionToPlayerTimeMin / FACTOR),
    DefaultALifeLairExpansionToPlayerTimeMax: Math.ceil(struct.DefaultALifeLairExpansionToPlayerTimeMax / FACTOR),
  });

  return newStruct.fork(true);
};

transformALifeDirectorScenarioPrototypes.files = ["/ALifeDirectorScenarioPrototypes.cfg"];
