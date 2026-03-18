import type { MetaType } from "../../src/meta-type.mts";

import { transformQuestRegistration } from "./transformQuestRegistration.mts";
import { transformQuestNodes } from "./transformQuestNodes.mts";
import { transformJournal } from "./transformJournal.mts";
import { transformDialogChains } from "./transformDialogChains.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformRewards } from "./transformRewards.mts";
import { transformRootgraph } from "./transformRootgraph.mts";

export const meta: MetaType = {
  description: `
Wolf's Heavy Armor Request
[hr][/hr]
Wolf in Rookie Village asks you to find a Heavy Battle Spark armor.[h1][/h1]
Deliver it and he rewards you with 5,000 money plus a stash clue.[h1][/h1]
The revealed stash contains a Neutral Exoskeleton armor, spawned on quest completion.[h1][/h1]
`,
  changenote: "Initial release",
  structTransformers: [
    transformQuestRegistration,
    transformQuestNodes,
    transformJournal,
    transformDialogChains,
    transformDialogPrototypes,
    transformRewards,
    transformRootgraph,
  ],
};
