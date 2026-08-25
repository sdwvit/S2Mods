import type { MetaType } from "../../src/meta-type.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
import { transformQuestRewardsPrototypes } from "./transformQuestRewardsPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";

const structTransformers = [
  transformDialogPrototypes,
  transformGlobalVariablePrototypes,
  transformQuestRewardsPrototypes,
  transformQuestNodePrototypes,
] as const;

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Unique and fair rewards for each possible variant of repeating side quests. Each quest variant gets its own reward scaled by distance, danger, and effort.

[url=https://docs.google.com/spreadsheets/d/191NWVb0VGKhryJAQenYTV2zbGuLk2RMkEOw5Tuo9WQw/edit?gid=0#gid=0]Quest reward data spreadsheet[/url]
[h3][/h3]
[hr][/hr]
[h3]Changes:[/h3]
[list]
 [*] Each repeating side quest variant now has a unique money reward based on travel distance, target danger, and effort required.
 [*] Rewards use a +/-20% spread around the calculated fair value.
 [*] Covers all recurring quest vendors: Warlock, Boozer, Owl, Sidorovych, Hera, Barkeep, Needle, Harpy.
 [*] Dialog now shows the correct reward amount for each quest.
[/list]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Dialog now shows the correct reward amount for each quest.",
  structTransformers: structTransformers as any,
};
