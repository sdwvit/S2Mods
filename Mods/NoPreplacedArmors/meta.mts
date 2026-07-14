import type { SpawnActorPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { allDefaultArmorPrototypesRecord } from "../../src/consts.mts";

export const meta: MetaType<SpawnActorPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
    This mode does only one thing: removes all armors placed around the Zone[hr][/hr]
Full scavenger mode! 
    
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
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
