import type { MetaType } from "../../src/meta-type.mts";
import { SPAWN_BUBBLE_FACTOR, transformAIGlobals } from "./transformAIGlobals.mts";
import {
  SQUARED_FACTOR,
  transformALifeDirectorScenarioPrototypes,
} from "./transformALifeDirectorScenarioPrototypes.mts";
import { CoreVariable } from "s2cfgtojson";

export const meta: MetaType = {
  description: `
Distant Horizons (Shay's) 250m: ALife Extension 
[hr][/hr]
This is an extension for Shay's 250m Distant Horizons mod[h1][/h1]
It modifies numerous parameters of Alife to account for increased spawn/despawn bubble
[hr][/hr]
For the best results, please install this mod after [url=https://www.nexusmods.com/stalker2heartofchornobyl/mods/1879?tab=files]Shay's 250m Distant Horizons mod.[/url]
[hr][/hr]
[list]
[*] MinALifeDespawnDistance increased 2.5x (to 75m)
[*] MinALifeSpawnDistance increased 2.5x (to 62.5m)
[*] MaxAgentsCount increased 18.75x (to 975)
[*] Reduce delay 6.25x for spawns in various contexts like Emission, Global, Local, Hub, Quiet, and others
[/list]
Non-bubble related changes:
[list]
[*] Allow Pseudogiants to spawn (max 0, 1, 2, 3 based on rank)
[*] Remove restrictions on which mutants can spawn naturally. 
[*] Remove restrictions on which NPC factions can spawn naturally. 
[/list]
`,
  changenote: "Initial release",
  structTransformers: [
    coreVarsTransformer,
    transformAIGlobals,
    transformALifeDirectorScenarioPrototypes,
  ],
};

function coreVarsTransformer(struct: CoreVariable) {
  if (struct.__internal__.rawName !== "DefaultConfig") {
    return;
  }
  const fork = struct.fork();
  fork.CorpseTimeout = Math.ceil(struct.CorpseTimeout / SQUARED_FACTOR);
  fork.CorpseOffscreenLifetime = Math.ceil(struct.CorpseOffscreenLifetime / SQUARED_FACTOR);
  fork.CorpseOnlineTime = Math.ceil(struct.CorpseOnlineTime / SQUARED_FACTOR);
  fork.CorpseALifeOnlineTime = Math.ceil(struct.CorpseALifeOnlineTime / SQUARED_FACTOR);
  fork.DeadBodyInvalidationTime = Math.ceil(struct.DeadBodyInvalidationTime / SQUARED_FACTOR);
  return fork;
}

coreVarsTransformer.files = ["/CoreVariables.cfg"];
