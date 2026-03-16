import type { MetaType } from "../../src/meta-type.mts";
import { transformKeyItemPrototypes } from "./transformKeyItemPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformItemGeneratorPrototypes } from "../FactionPatches/transformItemGeneratorPrototypes.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
export const meta: MetaType = {
  description: `
Decoupled Ranks separates player rank progression from story quest milestones.[h1][/h1]
Instead of quest nodes force-setting rank (Newbie/Experienced/Veteran/Master), this mod is intended to drive rank from an XP-like progression score.[h1][/h1]
Design goals:[h1][/h1]
- Keep rank progression consistent across different story paths.[h1][/h1]
- Make rank feel earned through play activity, not only mission scripting.[h1][/h1]
- Preserve existing rank-based systems (loot, trade, spawn scaling, dialogs) while changing only how rank is awarded.[h1][/h1]
Current implementation:[h1][/h1]
- Removes quest-driven rank setters.[h1][/h1]
- Introduces score thresholds that map to rank tiers.[h1][/h1]
- Apply rank updates through collecting XP.[h1][/h1]
- Get XP by picking up faction patches from dead bodies.[h1][/h1]
[hr][/hr]
With 2500 xp you advance from newbie to experienced, and that happens around Slug Heap. [h1][/h1]
`,
  changenote: "Move XP tracking out of inventory stacks; keep level and rank indicator items.",
  structTransformers: [transformQuestNodePrototypes, transformKeyItemPrototypes, transformGlobalVariablePrototypes, transformItemGeneratorPrototypes],
};
