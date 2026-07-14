import type { MetaType } from "../../src/meta-type.mts";
import type { SpawnActorPrototype } from "s2cfgtojson";
import { transformSpawnActorPrototypes } from "../CratesDontDropAnything/meta.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
Removes medicine drops from 🩹 Metal Crates.
[hr][/hr]
713 objects around the map now drop nothing[h1][/h1]
[hr][/hr]
bPatches SpawnActorPrototypes/WorldMap_WP/*.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [transformMedkitSpawnActorPrototypes],
};
const preplacedDestructibleItems = ["D_MetallCrate_01"];

function transformMedkitSpawnActorPrototypes(struct: SpawnActorPrototype) {
  return transformSpawnActorPrototypes(struct);
}

transformMedkitSpawnActorPrototypes.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformMedkitSpawnActorPrototypes.contains = true;
transformMedkitSpawnActorPrototypes.contents = [...preplacedDestructibleItems];
