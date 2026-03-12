import { SpawnActorPrototype } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";
import { allDefaultArmorPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
    This mode does only one thing: removes all armors placed around the Zone[hr][/hr]
Full scavenger mode! 
    `,
  changenote: "Initial release",
  structTransformers: [transformSpawnActorPrototypes],
};

/**
 * Removes preplaced items from the map
 */
export function transformSpawnActorPrototypes(struct: SpawnActorPrototype) {
  if (allDefaultArmorPrototypesRecord[struct.ItemSID]) {
    let fork = struct.fork();
    fork.SpawnOnStart = false;
    fork.ItemSID = struct.ItemSID;
    return fork;
  }
}

transformSpawnActorPrototypes.files = ["GameLite/GameData/SpawnActorPrototypes/WorldMap_WP/"];
transformSpawnActorPrototypes.contains = true;
transformSpawnActorPrototypes.contents = ["Armor", "Helmet"];
