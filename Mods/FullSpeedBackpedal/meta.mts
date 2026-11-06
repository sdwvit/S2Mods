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
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [transformObjPrototypes] as MetaType<Struct>["structTransformers"],
};
