import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformAnomalyPrototypes } from "./transformAnomalyPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Shards no longer kill mutants on touch: they only make them bleed.[h1][/h1]
[hr][/hr]
[list]
[*] Tushkans, boars, dogs and other mutants that run through Shards no longer drop dead on contact.
[*] Shards still cause bleeding and corrode gear, so a mutant can still bleed out.
[*] Applies to the player too: Shards wound you with bleeding and no longer deal direct damage.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [transformAnomalyPrototypes] as MetaType<Struct>["structTransformers"],
};
