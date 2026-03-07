import { MetaType } from "../../src/meta-type.mts";
import { SpawnActorPrototype, Struct } from "s2cfgtojson";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
Removes drops from destructible crates: 🍔 Wooden Boxes, 🍔 Plywood Crates, 🩹 Metal Crates, 🔫 Wooden Ammo Crates.
[hr][/hr]
3097 objects around the map now drop nothing[h1][/h1]
[hr][/hr]
bPatches SpawnActorPrototypes/WorldMap_WP/*.cfg
`,
  changenote: "Improved compatibility with recent game updates.",
  structTransformers: [transformSpawnActorPrototypes],
};
export const preplacedDestructibleItems = [
  "D_WoodenBox_01",
  "D_WoodenBox_02",
  "D_WoodenBox_03",
  "D_WoodenBox_04",
  "D_MetallCrate_01",
  "D_WoodenAmmoCrate_01",
  "D_WoodenDSPCrate_01",
  "D_WoodenDSPCrate_02",
  "D_WoodenDSPCrate_03",
];

export function transformSpawnActorPrototypes(struct: SpawnActorPrototype) {
  const fork = struct.fork();
  const itemGeneratorSettings = (struct as any).ItemGeneratorSettings;

  if (
    !itemGeneratorSettings ||
    typeof itemGeneratorSettings === "string" ||
    typeof itemGeneratorSettings.entries !== "function" ||
    !itemGeneratorSettings.entries().length
  ) {
    return;
  }

  fork.ItemGeneratorSettings = new Struct() as any;
  return fork;
}

transformSpawnActorPrototypes.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = preplacedDestructibleItems;
