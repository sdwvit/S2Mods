import type { MetaType } from "../../src/meta-type.mts";
import type { SpawnActorPrototype } from "s2cfgtojson";
import { transformSpawnActorPrototypes } from "../CratesDontDropAnything/meta.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
Removes medicine drops from 🩹 Metal Crates.
[hr][/hr]
713 objects around the map now drop nothing[h1][/h1]
[hr][/hr]
bPatches SpawnActorPrototypes/WorldMap_WP/*.cfg
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
