import type { Struct } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";
import { transformNPCNeedsPresetPrototypes } from "./transformNPCNeedsPresetPrototypes.mts";
import { transformGenericLairPrototypes } from "./transformGenericLairPrototypes.mts";
import { transformALifePopulationManagerFactionPrototypes } from "./transformALifePopulationManagerFactionPrototypes.mts";

export const meta: MetaType<Struct> = {
  description: `
Every faction and every mutant species can move out and take over other lairs.[h1][/h1]
[hr][/hr]
[list]
[*] Humans, zombies and all mutants share one urge to expand: a squad leaves as soon as its lair is big enough to send one, so territory shifts as you play.
[*] Lairs hold more inhabitants, so a lair can send a squad out without leaving home empty. Guard posts and rat nests stay vanilla.
[*] Every move into an occupied lair ends in a fight, and the Zone checks for moves far more often.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release.",
  structTransformers: [transformNPCNeedsPresetPrototypes, transformGenericLairPrototypes, transformALifePopulationManagerFactionPrototypes] as MetaType<Struct>["structTransformers"],
};
