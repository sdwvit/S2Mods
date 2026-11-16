import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Compatibility patch for [b]HeadlessArmors[/b] with [b]LairWars[/b] or [b]LairTiers[/b].[h1][/h1]
[hr][/hr]
The tougher humans that tier lairs spawn wear and drop HeadlessArmors suits and helmets, matched to their own rank. Without this patch they keep the vanilla suits.[h1][/h1]
Requires HeadlessArmors and one of LairWars or LairTiers.
`,
  changenote: "Initial release.",
  structTransformers: [transformItemGeneratorPrototypes] as MetaType<Struct>["structTransformers"],
};
