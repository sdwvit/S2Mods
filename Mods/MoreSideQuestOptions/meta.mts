import type { MetaType } from "../../src/meta-type.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformGlobalVariablePrototypes } from "./transformGlobalVariablePrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";
import { transformQuestPrototypes } from "./transformQuestPrototypes.mts";

export const meta: MetaType = {
  description: `
This mod expands the dialogue options offered by NPCs when requesting side quests.
Each repeatable sub-quest is recreated as an independent quest, startable from a hub menu.
`,
  changenote:
    "Independent quest system: all RSQ sub-quests available via hub dialog, with per-quest cancel",
  structTransformers: [
    transformDialogPrototypes,
    transformGlobalVariablePrototypes,
    transformQuestNodePrototypes,
    transformQuestPrototypes,
  ],
};
