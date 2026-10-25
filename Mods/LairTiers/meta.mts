import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { ON_WORLD_LOAD } from "./lairTierQuestNodes.mts";
import { transformAbilityPrototypes } from "./transformAbilityPrototypes.mts";
import { transformEnemyObjPrototypes } from "./transformEnemyObjPrototypes.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
import { transformItemGenerators } from "./transformItemGenerators.mts";
import { transformLairPrototypes } from "./transformLairPrototypes.mts";
import { transformLairSpawnActors } from "./transformLairSpawnActors.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformQuestPrototypes } from "./transformQuestPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Lairs grow tougher as you level up.[h1][/h1]
[hr][/hr]
[list]
[*] Every 3 levels, each lair moves up a tier.
[*] A tier mixes enemies of every rank, each carrying their own rank's weapons and armor. Higher-ranked enemies show up more often as you level, and you may rarely meet one even at level 1.
[*] Human enemy health scales with the tier: 1x at level 1, 2x at level 10, 3x at level 20, 4x at level 30.
[*] Higher-ranked mutants attack more often, up to twice as often. Weak mutants also gain health with the tier.
[*] Areas that quests clear of enemies stay clear.
[/list]
[hr][/hr]
Requires [b]Decoupled Ranks[/b], which provides the levels.[h1][/h1]
DLC lairs are not affected yet.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  // Saves from before the mod never ran rootgraph_Start with it, so its quest never started.
  gameStartCommand: `XStartQuestNodeBySID ${ON_WORLD_LOAD}`,
  structTransformers: [
    transformLairPrototypes,
    transformLairSpawnActors,
    transformEnemyObjPrototypes,
    transformAbilityPrototypes,
    transformItemGenerators,
    transformGlobalVariablePrototypes,
    transformQuestPrototypes,
    transformQuestNodePrototypes,
  ] as MetaType<Struct>["structTransformers"],
};
