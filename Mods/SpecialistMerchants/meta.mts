import type { MetaType } from "../../src/meta-type.mts";
import { transformTradePrototypes } from "./transformTradePrototypes.mts";
import { transformQuestObjPrototypes } from "./transformQuestObjPrototypes.mts";

export const meta: MetaType = {
  description: `
Specialist merchants: each trader category can only buy items relevant to their specialty.
[hr][/hr]
[list]
 [*] Bartenders only buy consumables and other misc items.
 [*] Medics only buy consumables (no mutant loot).
 [*] General traders can't buy weapons or armor.
 [*] General NPCs have scaled money per faction and buy weapons/armor only at 99%+ durability (no mutant loot).
 [*] Technicians only buy attachments, detectors, grenades, and night vision goggles.
 [*] Guides buy and sell key items like PDAs, with rank-based discounts.
 [*] Technicians and guides across the Zone now offer trading.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Recalculate faction money multipliers based on actual 6% buy rate and vanilla base (700): each faction NPC now affords their top armor",
  structTransformers: [transformTradePrototypes, transformQuestObjPrototypes] as any,
};
