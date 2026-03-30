import type { MetaType } from "../../src/meta-type.mts";
import { transformTradePrototypes } from "./transformTradePrototypes.mts";
import { transformQuestObjPrototypes } from "./transformQuestObjPrototypes.mts";

export const meta: MetaType = {
  description: `Specialist merchants: each trader category can only buy items relevant to their specialty.
[hr][/hr]
[list]
 [*] Bartenders only buy consumables and other misc items.
 [*] Medics only buy consumables (no mutant loot).
 [*] General traders buy everything at bad prices (except mutant loot).
 [*] Technicians only buy attachments, detectors, grenades, and night vision goggles.
 [*] Guides buy and sell key items like PDAs, with rank-based discounts.
 [*] Technicians and guides across the Zone now offer trading.
[/list]`,
  changenote: "Initial release",
  structTransformers: [transformTradePrototypes, transformQuestObjPrototypes] as any,
};
