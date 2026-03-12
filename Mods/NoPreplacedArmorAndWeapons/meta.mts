import { SpawnActorPrototype } from "s2cfgtojson";
import { MetaContext, MetaType } from "../../src/meta-type.mts";
import { allDefaultAttachPrototypesRecord, allUniqueWeaponPrototypeSIDs } from "../../src/consts.mts";
import { logger } from "../../src/logger.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
    This mode does only one thing: removes all 436 weapons / armors placed around the Zone[hr][/hr]
Full scavenger mode! 
    `,
  changenote: "Update for 1.8.1",
  structTransformers: [transformSpawnActorPrototypes],
  onFinish: () => logger.log(totals),
};

/**
 * Removes preplaced items from the map. Like medkits, destructible items contents, and gear.
 */
export function transformSpawnActorPrototypes(struct: SpawnActorPrototype, context: MetaContext<SpawnActorPrototype>) {
  let fork = struct.fork();

  switch (struct.SpawnType) {
    case "ESpawnType::PackOfItems":
    case "ESpawnType::Item": {
      fork = transformItems(struct, fork);
      break;
    }
  }

  if (fork && fork.entries().length) {
    return fork;
  }

  return null;
}

export const totals = {
  DestructibleObject: 0,
  Gear: 0,
  Medkit: 0,
  ItemContainer: 0,
};
const preplacedGear = ["Gun", "Armor", "Helmet"];

transformSpawnActorPrototypes.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = [...preplacedGear];

function transformItems(struct: SpawnActorPrototype, fork: SpawnActorPrototype) {
  const isGearReplacement =
    preplacedGear.some((i) => struct.ItemSID?.includes(i)) &&
    !allUniqueWeaponPrototypeSIDs.has(struct.ItemSID) &&
    !allDefaultAttachPrototypesRecord[struct.ItemSID];
  if (!isGearReplacement) {
    return;
  }
  if (isGearReplacement) {
    totals.Gear++;
    if (totals.Gear % 100 === 0) {
      logger.info(`Found ${totals.Gear} preplaced ${struct.ItemSID || struct.PackOfItemsPrototypeSID}. Hiding it.`);
    }
  }
  return Object.assign(fork, { SpawnOnStart: false, ItemSID: struct.ItemSID }) as SpawnActorPrototype;
}
