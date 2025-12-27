import { AIGlobal } from "s2cfgtojson";
import { MetaContext } from "../../src/meta-type.mts";

export const SPAWN_BUBBLE_FACTOR = 2.5; // 100m -> 250m radius

export async function transformAIGlobals(struct: AIGlobal, context: MetaContext<AIGlobal>) {
  const fork = struct.fork();

  if (context.filePath.endsWith("/AIGlobals.cfg")) {
    if (struct.__internal__.rawName !== "AISettings") {
      return null;
    }
    // fork.MinALifeDespawnDistance = struct.MinALifeDespawnDistance * SPAWN_BUBBLE_FACTOR ** 2;
    fork.MinALifeSpawnDistance = struct.MinALifeSpawnDistance * SPAWN_BUBBLE_FACTOR ** 2;
    fork.MaxAgentsCount = struct.MaxAgentsCount * SPAWN_BUBBLE_FACTOR ** 2;
    return fork;
  }
}

transformAIGlobals.files = ["/AIGlobals.cfg", "/CoreVariables.cfg"];
