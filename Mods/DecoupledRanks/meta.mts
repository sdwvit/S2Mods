import { MetaType } from "../../src/meta-type.mts";
import { addXpCounterItem } from "./addXpCounterItem.mts";
import { disableQuestRankSetters } from "./disableQuestRankSetters.mts";

export const meta: MetaType = {
  description: `
Decoupled Ranks separates player rank progression from story quest milestones.[h1][/h1]
Instead of quest nodes force-setting rank (Newbie/Experienced/Veteran/Master), this mod is intended to drive rank from an XP-like progression score.[h1][/h1]
Design goals:[h1][/h1]
- Keep rank progression consistent across different story paths.[h1][/h1]
- Make rank feel earned through play activity, not only mission scripting.[h1][/h1]
- Preserve existing rank-based systems (loot, trade, spawn scaling, dialogs) while changing only how rank is awarded.[h1][/h1]
Current implementation target:[h1][/h1]
- Remove or neutralize quest-driven rank setters.[h1][/h1]
- Introduce score thresholds that map to rank tiers.[h1][/h1]
- Apply rank updates through centralized progression logic.[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [disableQuestRankSetters, addXpCounterItem],
};
