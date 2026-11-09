import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformObjPrototypes } from "./transformObjPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Backpedal at full speed[h1][/h1]
[hr][/hr]
Walking, running and crouching backwards (or diagonally back) now moves you as fast as going forwards. Retreat from a bloodsucker without feeling like you are wading through tar.[h1][/h1]
[list]
[*] Affects only the player. NPCs and mutants keep their vanilla movement.
[*] Sprint, stamina, and forward speeds are unchanged.
[*] Small config patch: works with most other mods unless they also change the player's backwards speed.
[/list]
`,
  changenote: "Initial release.",
  structTransformers: [transformObjPrototypes] as MetaType<Struct>["structTransformers"],
};
