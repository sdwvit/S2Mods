import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformGeneralNPCObjPrototypes } from "./transformGeneralNPCObjPrototypes.mts";
import { transformRootgraph, transformQuestPrototypes } from "./transformRootgraph.mts";

export const meta: MetaType<Struct> = {
  description: `
Local test mod. Adds repeatable quest nodes that spawn a five-soldier faction squad at Skif's starting point in the first main mission.[h1][/h1]
[hr][/hr]
[list]
[*] Run [b]XStartQuestNodeBySID SpawnSquad<Faction>[/b] for the faction's own soldiers, or [b]SpawnSquad<Faction>Friendly[/b] for a copy of them that is friendly to the player.
[*] Factions: Bandit, Corpus, Duty, Freedom, Mercenaries, Militaries, Monolith, Neutral, Noon, Scientists, Spark, Varta (Ward).
[*] The squad stands in a row 10 m in front of the start point, 2.5 m apart, facing it.
[/list]
[hr][/hr]
bPatches: ObjPrototypes/GeneralNPCObjPrototypes.cfg, QuestPrototypes/rootgraph.cfg, QuestNodePrototypes/rootgraph.cfg
  `,
  changenote: "Initial release.",
  structTransformers: [transformGeneralNPCObjPrototypes, transformRootgraph, transformQuestPrototypes],
};
