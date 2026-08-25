import type { MetaType } from "../../src/meta-type.mts";

import { transformObjPrototypes } from "./transformObjPrototypes.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { transformCluePrototypes } from "./transformCluePrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformQuestPrototypes } from "./transformQuestPrototypes.mts";
export const finishedTransformers = new Set<string>();

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
This mod reworks the stash clues system and makes exploring stashes a bit more interesting.
[hr][/hr]
First, it makes all existing stashes to not spawn on game start (new game required).[h1][/h1]
Second, it injects 100 variables corresponding to localizations for stashes.[h1][/h1]
It is then uses those variables and despawned stashes to make them quest stashes instead.[h1][/h1]
Once you finish any recurring quest from base vendors, apart from monetary reward, they give you a stash clue to a random stash grabbed in the first step.[h1][/h1]
[hr][/hr]
bPatches: SpawnActorPrototypes/WorldMap_WP/*.cfg, CluePrototypes.cfg,

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Minor cleanup and stability improvements.",
  structTransformers: [
    transformObjPrototypes,
    transformSpawnActorPrototypes,
    transformQuestPrototypes,
    transformCluePrototypes,
    transformQuestNodePrototypes,
  ],
  onTransformerFinish(transformer) {
    finishedTransformers.add(transformer.name);
  },
};
