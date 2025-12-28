import { ALifeDirectorScenarioPrototype, Struct } from "s2cfgtojson";

import { SPAWN_BUBBLE_FACTOR } from "./transformAIGlobals.mts";
import { EntriesTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";
import { markAsForkRecursively } from "../../src/mark-as-fork-recursively.mts";
import { DIFFICULTY_FACTOR } from "./transformDifficultyPrototypes.mts";

const factor = DIFFICULTY_FACTOR * SPAWN_BUBBLE_FACTOR ** 2;
/**
 * Transforms ALifeDirectorScenarioPrototypes to adjust NPC limits and spawn parameters.
 */
export const transformALifeDirectorScenarioPrototypes: EntriesTransformer<ALifeDirectorScenarioPrototype> = async (struct, {}) => {
  const newStruct = struct.fork();
  const RestrictedObjPrototypeSIDs = struct.RestrictedObjPrototypeSIDs.map(([k, v]) => {
    if (v.startsWith("GeneralNPC_Spark") || v.startsWith("GeneralNPC_Scientists")) {
      return "GuardNPC_Duty_CloseCombat";
    }
  });
  RestrictedObjPrototypeSIDs.__internal__.useAsterisk = false;

  const ProhibitedAgentTypes = struct.ProhibitedAgentTypes.map(() => "EAgentType::RatSwarm");
  ProhibitedAgentTypes.__internal__.useAsterisk = false;

  const ALifeScenarioNPCArchetypesLimitsPerPlayerRank = struct.ALifeScenarioNPCArchetypesLimitsPerPlayerRank.map(([_k, e]) => {
    const fork = e.fork();
    fork.Restrictions = e.Restrictions.map(([_k, e]) => {
      const fork = e.fork();
      fork.MaxCount = e.MaxCount || 1;
      fork.MaxCount *= 2;
      return fork;
    });
    fork.Restrictions.__internal__.useAsterisk = false;
    fork.Restrictions.addNode(
      new Struct({ AgentType: "EAgentType::Pseudogiant", MaxCount: 1.5, __internal__: { rawName: "_" } }),
      `${modName}_Pseudogiant`,
    );

    return fork;
  });
  ALifeScenarioNPCArchetypesLimitsPerPlayerRank.__internal__.useAsterisk = false;

  const Scenarios = struct.Scenarios.map(([_, v]) => {
    const fork = v.fork();
    const ScenarioSquads = v.ScenarioSquads.map(([_, e]) => {
      if (e.bPlayerEnemy) {
        const fork = e.fork();
        fork.AliveMultiplierMin = e.AliveMultiplierMin * DIFFICULTY_FACTOR;
        fork.AliveMultiplierMax = e.AliveMultiplierMax * DIFFICULTY_FACTOR;
        return fork;
      }
    });
    ScenarioSquads.__internal__.useAsterisk = false;
    if (v.ScenarioSquads.entries().filter(([_, v]) => v.bPlayerEnemy).length) {
      fork.ScenarioSquads = ScenarioSquads;
    }

    if (v.ExpansionSquadNumMin) fork.ExpansionSquadNumMin = v.ExpansionSquadNumMin * DIFFICULTY_FACTOR;
    if (v.ExpansionSquadNumMax) fork.ExpansionSquadNumMax = v.ExpansionSquadNumMax * DIFFICULTY_FACTOR;
    if (fork.entries().length) {
      return fork;
    }
  });
  Scenarios.__internal__.useAsterisk = false;

  const ScenarioGroups = struct.ScenarioGroups.map(([_, v]) => {
    const fork = v.fork();
    if (v.SpawnDelayMin) fork.SpawnDelayMin = Math.ceil(v.SpawnDelayMin / factor);
    if (v.SpawnDelayMax) fork.SpawnDelayMax = Math.ceil(v.SpawnDelayMax / factor);
    if (v.PostSpawnDirectorTimeoutMin) fork.PostSpawnDirectorTimeoutMin = Math.ceil(v.PostSpawnDirectorTimeoutMin / factor);
    if (v.PostSpawnDirectorTimeoutMax) fork.PostSpawnDirectorTimeoutMax = Math.ceil(v.PostSpawnDirectorTimeoutMax / factor);
    if (fork.entries().length) {
      return fork;
    }
  });
  ScenarioGroups.__internal__.useAsterisk = false;

  Object.assign(newStruct, {
    ALifeScenarioNPCArchetypesLimitsPerPlayerRank,
    RestrictedObjPrototypeSIDs,
    ProhibitedAgentTypes,
    Scenarios,
    ScenarioGroups,
  });
  return markAsForkRecursively(newStruct);
};

transformALifeDirectorScenarioPrototypes.files = ["/ALifeDirectorScenarioPrototypes.cfg"];
