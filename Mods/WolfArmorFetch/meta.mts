import type { MetaType } from "../../src/meta-type.mts";

import { transformQuestRegistration } from "./transformQuestRegistration.mts";
import { transformQuestNodes } from "./transformQuestNodes.mts";
import { transformJournal } from "./transformJournal.mts";
import { transformDialogChains } from "./transformDialogChains.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformRewards } from "./transformRewards.mts";
import { transformRootgraph } from "./transformRootgraph.mts";
import { transformRookieVillageHub } from "./transformRookieVillageHub.mts";

export const meta: MetaType = {
  description: `
Wolf's Jobs
[hr][/hr]
Wolf in Rookie Village has two jobs for you.[h1][/h1]
The first is personal: Wolf has picked up a lead on an old score and needs you to fetch something for him.[h1][/h1]
The second follows a day later and builds on what the first one turned up.[h1][/h1]
You can turn a job down and come back for it later. Wolf has a side quest marker while a job is on offer.[h1][/h1]
Works on existing saves. Dialogs and journal text are translated into every language the game supports.[h1][/h1]
`,
  changenote: "A new job from Wolf, a rewritten second job, and a different stash reward when the latest HeadlessArmors is installed.",
  structTransformers: [
    transformQuestRegistration,
    transformQuestNodes,
    transformJournal,
    transformDialogChains,
    transformDialogPrototypes,
    transformRewards,
    transformRootgraph,
    transformRookieVillageHub,
  ],
};
