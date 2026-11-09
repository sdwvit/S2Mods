import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformMobs } from "./transformMobs.mts";

export const meta: MetaType<Struct> = {
  description: `
Compatibility patch for [b]NoAPForMobs[/b] with [b]LairWars[/b] or [b]LairTiers[/b].[h1][/h1]
[hr][/hr]
The tougher mutants that tier lairs spawn get NoAPForMobs' zero bullet armor too. Without this patch they keep the vanilla armor of the mutant they're based on.[h1][/h1]
Requires NoAPForMobs and one of LairWars or LairTiers.
`,
  changenote: "Initial release.",
  structTransformers: [transformMobs] as MetaType<Struct>["structTransformers"],
};
