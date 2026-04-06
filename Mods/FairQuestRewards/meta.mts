import type { MetaType } from "../../src/meta-type.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
import { transformQuestRewardsPrototypes } from "./transformQuestRewardsPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";

const structTransformers = [
  transformGlobalVariablePrototypes,
  transformQuestRewardsPrototypes,
  transformQuestNodePrototypes,
] as const;

export const meta: MetaType<Parameters<(typeof structTransformers)[number]>[0]> = {
  originalAuthor: "GrimS2",
  description: `Unique and fair rewards for each possible variant of repeating side quests. Each quest variant gets its own reward scaled by distance, danger, and effort.[h3][/h3]
[hr][/hr]
[h3]Changes:[/h3]
[list]
 [*] Each repeating side quest variant now has a unique money reward based on travel distance, target danger, and effort required.
 [*] Rewards use a +/-20% spread around the calculated fair value.
 [*] Covers all recurring quest vendors: Warlock, Boozer, Owl, Sidorovych, Hera, Barkeep, Needle, Harpy.
[/list]`,
  changenote: "Initial release — extracted from MasterMod.",
  structTransformers: structTransformers as any,
};
