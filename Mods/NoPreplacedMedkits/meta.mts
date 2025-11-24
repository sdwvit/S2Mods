import { SpawnActorPrototype } from "s2cfgtojson";
import { MetaType } from "../../src/metaType.mjs";
import { logger } from "../../src/logger.mjs";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `This mode does only one thing: removes all 650+ medkits placed around the map for more challenging gameplay.[h1][/h1]
[hr][/hr]
😤 Tired of those cute little medkits scattered around the map like breadcrumbs for weaklings?[h1][/h1]
💀 This mod is for players who want to feel the sting of death without any pre-placed safety nets.[h1][/h1]
🕸️ Increased tension. Every bullet, tripwire, and mutant encounter feels like a 10/10 horror movie.[h1][/h1]
⚰️ Achievement unlocked: “I DIED 47 TIMES BEFORE REACHING ZALISSYA.”[h1][/h1]
[hr][/hr]
It is meant to be used in other collections of mods. Does not conflict with anything.
[hr][/hr]
Thanks @rbwadle for suggesting how to modify map objects.`,
  changenote: "Update for 1.7.1",
  structTransformers: [transformItems],
};

function transformItems(struct: SpawnActorPrototype) {
  if (struct.SpawnType !== "ESpawnType::Item" && struct.SpawnType !== "ESpawnType::PackOfItems") {
    return;
  }
  const isMedkitReplacement = struct.ItemSID?.includes("Medkit") || struct.PackOfItemsPrototypeSID?.includes("Medkit");

  if (!isMedkitReplacement) {
    return;
  }
  logger.info(`Found preplaced Item: ${struct.ItemSID || struct.PackOfItemsPrototypeSID}. Hiding it.`);

  return Object.assign(struct.fork(), { SpawnOnStart: false }) as SpawnActorPrototype;
}
transformItems.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformItems.contains = true;
transformItems.contents = ["Medkit"];
