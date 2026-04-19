import { Struct } from "s2cfgtojson";
import type { ALifeDirectorScenarioPrototype } from "s2cfgtojson";

import { SPAWN_BUBBLE_FACTOR } from "./transformAIGlobals.mts";
import type { StructTransformer } from "../../src/meta-type.mts";

export const SQUARED_FACTOR = SPAWN_BUBBLE_FACTOR ** 2;
/**
 * Transforms ALifeDirectorScenarioPrototypes to adjust NPC limits and spawn parameters.
 */
export const transformALifeDirectorScenarioPrototypes: StructTransformer<ALifeDirectorScenarioPrototype> = async (struct, {}) => {
  const newStruct = struct.fork();
  const RestrictedObjPrototypeSIDs = struct.RestrictedObjPrototypeSIDs.map(([k, v]) => {
    if (v.startsWith("GeneralNPC_Spark") || v.startsWith("GeneralNPC_Scientists")) {
      return "GuardNPC_Duty_CloseCombat";
    }
  });
  RestrictedObjPrototypeSIDs.__internal__.useAsterisk = false;

  const ProhibitedAgentTypes = struct.ProhibitedAgentTypes.map(() => "EAgentType::RatSwarm");
  ProhibitedAgentTypes.__internal__.useAsterisk = false;

  const ALifeScenarioNPCArchetypesLimitsPerPlayerRank = struct.ALifeScenarioNPCArchetypesLimitsPerPlayerRank.map(([_k, e], i) => {
    if (!i) {
      return;
    }
    const fork = e.fork();
    fork.Restrictions = e.Restrictions.fork();
    fork.Restrictions.__internal__.useAsterisk = false;
    fork.Restrictions.addNode(new Struct({ AgentType: "EAgentType::Pseudogiant", MaxCount: i, __internal__: { rawName: "_" } }), `Pseudogiant`);

    return fork;
  });
  ALifeScenarioNPCArchetypesLimitsPerPlayerRank.__internal__.useAsterisk = false;

  const ScenarioGroups = struct.ScenarioGroups.map(([_, v]) => {
    const fork = v.fork();
    if (v.SpawnDelayMin) fork.SpawnDelayMin = Math.ceil(v.SpawnDelayMin / SQUARED_FACTOR);
    if (v.SpawnDelayMax) fork.SpawnDelayMax = Math.ceil(v.SpawnDelayMax / SQUARED_FACTOR);
    if (v.PostSpawnDirectorTimeoutMin) fork.PostSpawnDirectorTimeoutMin = Math.ceil(v.PostSpawnDirectorTimeoutMin / SQUARED_FACTOR);
    if (v.PostSpawnDirectorTimeoutMax) fork.PostSpawnDirectorTimeoutMax = Math.ceil(v.PostSpawnDirectorTimeoutMax / SQUARED_FACTOR);
    if (fork.entries().length) {
      return fork;
    }
  });
  ScenarioGroups.__internal__.useAsterisk = false;

  Object.assign(newStruct, {
    ALifeScenarioNPCArchetypesLimitsPerPlayerRank,
    RestrictedObjPrototypeSIDs,
    ProhibitedAgentTypes,
    ScenarioGroups,
    DefaultALifeLairExpansionToPlayerTimeMax: Math.ceil(struct.DefaultALifeLairExpansionToPlayerTimeMax / SQUARED_FACTOR),
    DefaultALifeLairExpansionToPlayerTimeMin: Math.ceil(struct.DefaultALifeLairExpansionToPlayerTimeMin / SQUARED_FACTOR),
    DefaultSpawnDelayMax: Math.ceil(struct.DefaultSpawnDelayMax / SQUARED_FACTOR),
    DefaultSpawnDelayMin: Math.ceil(struct.DefaultSpawnDelayMin / SQUARED_FACTOR),
  });
  return newStruct.fork(true);
};

transformALifeDirectorScenarioPrototypes.files = ["/ALifeDirectorScenarioPrototypes.cfg"];
