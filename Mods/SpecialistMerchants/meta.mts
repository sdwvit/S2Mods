import type { MetaType } from "../../src/meta-type.mts";
import { transformTradePrototypes } from "./transformTradePrototypes.mts";
import { transformQuestObjPrototypes } from "./transformQuestObjPrototypes.mts";
import { transformQuestItemPrototypes } from "./transformQuestItemPrototypes.mts";

export const meta: MetaType = {
  description: `
Specialist merchants: each trader category can only buy items relevant to their specialty.
[hr][/hr]
[list]
 [*] Bartenders only buy consumables and other misc items.
 [*] Medics only buy consumables (no mutant loot).
 [*] General traders can't buy weapons or armor.
 [*] General NPCs have scaled money per faction and buy weapons/armor only at 99%+ durability (no mutant loot).
 [*] Technicians only buy attachments, detectors, grenades, night vision goggles, and binoculars.
 [*] Salvaged lab electronics sell only to technicians and regular stalkers.
 [*] Guides buy and sell key items like PDAs, with rank-based discounts.
 [*] Technicians and guides across the Zone now offer trading.
[/list]
`,
  changenote: "Salvaged lab electronics now sell only to technicians and regular stalkers.",
  structTransformers: [transformTradePrototypes, transformQuestObjPrototypes, transformQuestItemPrototypes] as any,
};
