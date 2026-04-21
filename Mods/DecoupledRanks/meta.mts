import type { MetaType } from "../../src/meta-type.mts";
import { transformKeyItemPrototypes } from "./transformKeyItemPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformItemGeneratorPrototypes } from "../FactionPatches/transformItemGeneratorPrototypes.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
import { addMutantPartItems } from "./addMutantPartItems.mts";
import { transformMutantLootGenerators } from "./transformMutantLootGenerators.mts";
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
- Get XP by picking up faction patches from dead bodies and mutant parts from killed mutants.[h1][/h1]
[hr][/hr]
With 2500 xp you advance from newbie to experienced, and that happens around Slug Heap. [h1][/h1]
Level 30 caps out at 330000 XP, with levels past 15 scaling exponentially to stretch endgame progression. [h1][/h1]
[hr][/hr]
XP table:[h1][/h1]
- Level 1: 0 XP — Newbie[h1][/h1]
- Level 2: 350 XP[h1][/h1]
- Level 3: 900 XP[h1][/h1]
- Level 4: 1600 XP[h1][/h1]
- Level 5: 2450 XP[h1][/h1]
- Level 6: 3350 XP[h1][/h1]
- Level 7: 3950 XP[h1][/h1]
- Level 8: 4400 XP[h1][/h1]
- Level 9: 4750 XP[h1][/h1]
- Level 10: 5000 XP — Experienced[h1][/h1]
- Level 11: 5900 XP[h1][/h1]
- Level 12: 7000 XP[h1][/h1]
- Level 13: 8300 XP[h1][/h1]
- Level 14: 9800 XP[h1][/h1]
- Level 15: 11500 XP[h1][/h1]
- Level 16: 14500 XP[h1][/h1]
- Level 17: 18000 XP[h1][/h1]
- Level 18: 22500 XP[h1][/h1]
- Level 19: 28000 XP[h1][/h1]
- Level 20: 35000 XP — Veteran[h1][/h1]
- Level 21: 44000 XP[h1][/h1]
- Level 22: 55000 XP[h1][/h1]
- Level 23: 69000 XP[h1][/h1]
- Level 24: 86000 XP[h1][/h1]
- Level 25: 108000 XP[h1][/h1]
- Level 26: 135000 XP[h1][/h1]
- Level 27: 169000 XP[h1][/h1]
- Level 28: 211000 XP[h1][/h1]
- Level 29: 264000 XP[h1][/h1]
- Level 30: 330000 XP — Master[h1][/h1]
`,
  changenote: "Scale level thresholds past 15 exponentially: level 30 now requires 330000 XP (up from 36000).",
  structTransformers: [transformQuestNodePrototypes, transformKeyItemPrototypes, transformGlobalVariablePrototypes, transformItemGeneratorPrototypes, addMutantPartItems, transformMutantLootGenerators],
};
