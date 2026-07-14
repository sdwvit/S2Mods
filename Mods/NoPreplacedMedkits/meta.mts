import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { logger } from "../../src/logger.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
This mode does only one thing: removes all 650+ medkits placed around the map for more challenging gameplay.[h1][/h1]
[hr][/hr]
😤 Tired of those cute little medkits scattered around the map like breadcrumbs for weaklings?[h1][/h1]
💀 This mod is for players who want to feel the sting of death without any pre-placed safety nets.[h1][/h1]
🕸️ Increased tension. Every bullet, tripwire, and mutant encounter feels like a 10/10 horror movie.[h1][/h1]
⚰️ Achievement unlocked: “I DIED 47 TIMES BEFORE REACHING ZALISSYA.”[h1][/h1]
[hr][/hr]
It is meant to be used in other collections of mods. Does not conflict with anything.
[hr][/hr]
Thanks @rbwadle for suggesting how to modify map objects.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Update for 1.8.1",
  structTransformers: [transformItems],
};

export const totals = {
  DestructibleObject: 0,
  Gear: 0,
  Medkit: 0,
  ItemContainer: 0,
};
function transformItems(struct: SpawnActorPrototype) {
  if (struct.SpawnType !== "ESpawnType::Item" && struct.SpawnType !== "ESpawnType::PackOfItems") {
    return;
  }
  const isMedkitReplacement = struct.ItemSID?.includes("Medkit") || struct.PackOfItemsPrototypeSID?.includes("Medkit");

  if (!isMedkitReplacement) {
    return;
  }
  totals.Medkit++;
  if (totals.Medkit % 100 === 0) {
    logger.info(`Found ${totals.Medkit} preplaced ${struct.ItemSID || struct.PackOfItemsPrototypeSID}. Hiding it.`);
  }

  return Object.assign(struct.fork(), { SpawnOnStart: false }) as SpawnActorPrototype;
}
transformItems.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformItems.contains = true;
transformItems.contents = ["Medkit"];
