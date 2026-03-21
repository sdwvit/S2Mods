import type { MetaType } from "../../src/meta-type.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformQuestNodePrototypes } from "./transformQuestNodePrototypes.mts";

export const meta: MetaType = {
  description: `
This mod does one thing only: expands the dialogue options offered by NPCs when requesting side quests.
`,
  changenote: "All RSQ quest options now appear simultaneously in fixed order instead of one random pick",
  structTransformers: [transformDialogPrototypes, transformQuestNodePrototypes],
};
