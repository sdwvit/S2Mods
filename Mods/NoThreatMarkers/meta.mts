import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";

export const meta: MetaType<Struct> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
This mod removes threat indicators. Meaning you can no longer see any markers, blue or red compass shadow indicating the presence or absence of enemies or their direction.[h1][/h1]
     [hr][/hr]
     Let's make the game scary again.[h1][/h1]
      [hr][/hr]
      It is meant to be used in other collections of mods.[h1][/h1] 
      Does not conflict with anything, well except for mods that modify compass textures.
`,
  changenote: "Updated to 1.7.x, now includes NoEnemyMarkers. So install either this or that one. ",
  structTransformers: [],
};
