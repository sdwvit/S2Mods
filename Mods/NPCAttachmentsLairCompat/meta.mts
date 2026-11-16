import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Compatibility patch for [b]NPC Attachments[/b] with [b]LairWars[/b] or [b]LairTiers[/b].[h1][/h1]
[hr][/hr]
The tougher humans that tier lairs spawn roll weapons with attachments too, at the same rarity as NPC Attachments. Without this patch they only carry bare weapons.[h1][/h1]
Requires NPC Attachments and one of LairWars or LairTiers.
`,
  changenote: "Initial release.",
  structTransformers: [transformItemGeneratorPrototypes] as MetaType<Struct>["structTransformers"],
};
