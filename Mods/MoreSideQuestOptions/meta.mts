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
    "Enable Rostok Duty kill quest (RSQ08_C09_S_P) by removing main quest gate from rotation",
  structTransformers: [
    transformDialogPrototypes,
    transformGlobalVariablePrototypes,
    transformQuestNodePrototypes,
    transformQuestPrototypes,
  ],
};

// todo there is still problem with turning in incomplete jobs.
//   also some vendors don't have the job hub from get-go, like warlock, likely due to the main quest dialogs he has