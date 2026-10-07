import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Hard cap on concurrent online AI agents (vanilla 52, shared by the whole world). Rostok
 * already spends most of that budget on its scripted population, so two war garrisons could
 * never materialize underneath it however large the lair prototype says they are. This is the
 * ceiling every other spawn number in the mod sits under.
 */
const MAX_AGENTS = 200;

/**
 * The A-Life bubble, in Unreal units (1 uu = 1 cm). Vanilla keeps agents online only within
 * ~25-30 m, but the two test lairs are 69 m apart: at vanilla range only the camp you are
 * standing in is ever online, so the fight is unobservable even when it happens. Widened to
 * ~125/150 m so both garrisons stay live at once.
 */
const SPAWN_DISTANCE = 12500;
const DESPAWN_DISTANCE = 15000;

export const transformAIGlobals: StructTransformer<any> = (struct) => {
  // AISettings has no SID - it is matched by its struct name.
  if (struct.__internal__.rawName !== "AISettings") return null;

  const fork = struct.fork();
  fork.MaxAgentsCount = MAX_AGENTS;
  fork.MinALifeSpawnDistance = SPAWN_DISTANCE;
  fork.MinALifeDespawnDistance = DESPAWN_DISTANCE;
  return fork;
};

transformAIGlobals.files = ["/AIGlobals.cfg"];
