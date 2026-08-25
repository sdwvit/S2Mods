import type { MetaType } from "../../src/meta-type.mts";
import { SPAWN_BUBBLE_FACTOR, transformAIGlobals } from "./transformAIGlobals.mts";
import {
  SQUARED_FACTOR,
  transformALifeDirectorScenarioPrototypes,
} from "./transformALifeDirectorScenarioPrototypes.mts";
import { type CoreVariable } from "s2cfgtojson";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
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
[*] MaxAgentsCount increased 6.25x (to 325)
[*] Reduce delay 6.25x for spawns in various contexts like Emission, Global, Local, Hub, Quiet, and others
[*] Reduce corpse/dead body timeouts 6.25x to keep up with the larger spawn volume
[/list]
Non-bubble related changes:
[list]
[*] Allow Pseudogiants to spawn (max 0, 1, 2, 3 based on rank)
[*] Remove restrictions on which mutants can spawn naturally.
[*] Remove restrictions on which NPC factions can spawn naturally.
[/list]

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: `
[list]
[*] Rebalanced Swamp_ScenarioGroups weights: generic Mutant scenarios (Mutant3_5VsMutant3_5, Mutant5_7VsMutant5_7 - the only Pseudogiant spawn vector) lowered from 5 to 1, and specific-mutant scenarios (BlinddogPack, BoarPack, FleshPack, SnorkPack, BloodsuckerSingle, BloodsuckerDuo, CatPack) added at weight 5. Pseudogiants become ~2/37 of swamp rolls instead of dominating.
[/list]
`,
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
