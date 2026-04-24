import type { AIGlobal } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";

export const SPAWN_BUBBLE_FACTOR = 2.5; // 100m -> 250m radius
export const SQUARED_FACTOR = SPAWN_BUBBLE_FACTOR ** 2;

export async function transformAIGlobals(struct: AIGlobal, context: MetaContext<AIGlobal>) {
  const fork = struct.fork();

  if (context.filePath.endsWith("/AIGlobals.cfg")) {
    if (struct.__internal__.rawName !== "AISettings") {
      return null;
    }
    fork.MinALifeDespawnDistance = struct.MinALifeDespawnDistance * SPAWN_BUBBLE_FACTOR;
    fork.MinALifeSpawnDistance = struct.MinALifeSpawnDistance * SPAWN_BUBBLE_FACTOR;
    fork.MaxAgentsCount = struct.MaxAgentsCount * SQUARED_FACTOR;
    return fork;
  }
}

transformAIGlobals.files = ["/AIGlobals.cfg"];
