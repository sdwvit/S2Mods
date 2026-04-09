import type { CoreVariable } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformALifeDirectorScenarioPrototypes } from "./transformALifeDirectorScenarioPrototypes.mts";

export const meta: MetaType = {
  description: `
More Chaos[h1][/h1]
Doubles squad sizes, doubles spawn frequency, and speeds up corpse cleanup.
[hr][/hr]
[list]
[*] Squad AliveMultiplier doubled (2x more alive NPCs per squad)
[*] Expansion squad numbers doubled
[*] All spawn delays halved (2x faster spawns)
[*] Corpse despawn timeouts halved (faster cleanup)
[/list]
`,
  changenote: "Initial release",
  structTransformers: [transformALifeDirectorScenarioPrototypes, coreVarsTransformer],
};

const FACTOR = 2;

function coreVarsTransformer(struct: CoreVariable) {
  if (struct.__internal__.rawName !== "DefaultConfig") {
    return;
  }
  const fork = struct.fork();
  fork.CorpseTimeout = Math.ceil(struct.CorpseTimeout / FACTOR);
  fork.CorpseOffscreenLifetime = Math.ceil(struct.CorpseOffscreenLifetime / FACTOR);
  fork.CorpseOnlineTime = Math.ceil(struct.CorpseOnlineTime / FACTOR);
  fork.CorpseALifeOnlineTime = Math.ceil(struct.CorpseALifeOnlineTime / FACTOR);
  fork.DeadBodyInvalidationTime = Math.ceil(struct.DeadBodyInvalidationTime / FACTOR);
  return fork;
}

coreVarsTransformer.files = [];
