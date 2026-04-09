import type { MetaType } from "../../src/meta-type.mts";
import { transformRelationPrototypes } from "./transformRelationPrototypes.mts";

export const meta: MetaType = {
  description: `
Fixes some of the faction relationships to be more lore-friendly.[h1][/h1]
[hr][/hr]
[list]
 [*] Bandits, Mercenaries, and Freedom are neutral to each other.
 [*] Mercenaries are hostile to Duty, Free Stalkers, and Militaries.
 [*] Mercenaries are neutral to Spark and Varta.
 [*] Freedom and Duty are hostile to each other.
 [*] Varta and Spark are hostile to each other.
[/list]`,
  changenote: "Initial release",
  structTransformers: [transformRelationPrototypes],
};
