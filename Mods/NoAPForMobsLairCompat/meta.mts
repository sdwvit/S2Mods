import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformMobs } from "./transformMobs.mts";

export const meta: MetaType<Struct> = {
  description: `
Compatibility patch for [b]NoAPForMobs[/b] with [b]LairWars[/b] or [b]LairTiers[/b].[h1][/h1]
[hr][/hr]
[list]
[*] The tougher mutants that tier lairs spawn get NoAPForMobs' zero bullet armour too. Without this patch they keep the vanilla armour of the mutant they're based on.
[*] Requires NoAPForMobs and one of LairWars or LairTiers.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [transformMobs] as MetaType<Struct>["structTransformers"],
};
