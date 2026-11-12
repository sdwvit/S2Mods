import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformItemGeneratorPrototypes } from "./transformItemGeneratorPrototypes.mts";

export const meta: MetaType<Struct> = {
  nameOverride: "Cost of Hope DLC Extension for NPC Attachments",
  description: `
Brings NPC Attachments to the Cost of Hope DLC: NPCs there carry weapons with attachments too, including the DLC's own guns.
[hr][/hr]
Requires the Cost of Hope DLC. Use it together with NPC Attachments, which covers the base game.
[h1][/h1]
Same rarity as NPC Attachments: 1-attachment weapons are 10x rarer than base, each extra attachment is 10x rarer than the previous.
`,
  changenote: "New name and logo.",
  structTransformers: [transformItemGeneratorPrototypes] as MetaType<Struct>["structTransformers"],
};
