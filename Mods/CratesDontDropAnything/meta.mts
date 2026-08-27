import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { SpawnActorPrototype } from "s2cfgtojson";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
Removes drops from destructible crates: 🍔 Wooden Boxes, 🍔 Plywood Crates, 🩹 Metal Crates, 🔫 Wooden Ammo Crates.
[hr][/hr]
3097 objects around the map now drop nothing[h1][/h1]
[hr][/hr]
bPatches SpawnActorPrototypes/WorldMap_WP/*.cfg

[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Updated for 2.0: patches regenerated against 2.0 game data.",
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
