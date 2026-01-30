import { MetaType, StructTransformer } from "../../src/meta-type.mts";

import { transformObjPrototypes } from "./transformObjPrototypes.mts";
import { transformCluePrototypes } from "./transformCluePrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformSpawnActorPrototypes } from "./transformSpawnActorPrototypes.mts";
import { Struct } from "s2cfgtojson";

export const finishedTransformers = new Set<string>();

export const meta: MetaType = {
  description: `
This mod reworks the stash clues system and makes exploring stashes a bit more interesting.
[hr][/hr]
First, it makes all existing stashes to not spawn on game start (new game required).[h1][/h1]
Second, it injects 100 variables corresponding to localizations for stashes.[h1][/h1]
It is then uses those variables and despawned stashes to make them quest stashes instead.[h1][/h1]
Once you finish any recurring quest from base vendors, apart from monetary reward, they give you a stash clue to a random stash grabbed in the first step.[h1][/h1]
[hr][/hr]
bPatches: SpawnActorPrototypes/WorldMap_WP/*.cfg, CluePrototypes.cfg,
`,
  changenote: "Fix npcs giving clues",
  structTransformers: [transformSpawnActorPrototypes, transformCluePrototypes, transformQuestNodePrototypes, transformObjPrototypes],
  onTransformerFinish(transformer: StructTransformer<Struct>) {
    finishedTransformers.add(transformer.name);
  },
};
