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
First, a personal one: Huron let slip that one of his debtors carries a Ward Fora, and Wolf has been hunting the Ward sniper who carried one like it. Find the debtor and bring Wolf the rifle.[h1][/h1]
A day later, the second job. The rifle's serial gave Wolf the sniper's name and nothing more, so he plans to take a few Ward soldiers alive and question them. To lure them out, he needs a PSZ-9I Falcon.[h1][/h1]
Dialogs and journal text are translated into every language the game supports.[h1][/h1]
`,
  changenote: "New first job from Wolf: bring him the Decider from Huron's debtor, for 10,000 coupons. The Falcon job is now called Falconry, with a new story that follows on from the Decider: Wolf wants the suit to lure Ward soldiers into an ambush. Wolf offers it one in-game day after the Decider hand-in, and you can ask him why he needs the suit, what happens to the prisoners and where to find one. The stash exoskeleton is now at 30% durability. With HeadlessArmors installed, it's the headless exoskeleton at 40% durability instead. If your save already took the Falcon job, you finish that first and get the Decider job afterwards. Wolf's topics now come from Rookie Village's own dialog flow, so they show up reliably after loads and story phases. Wolf has a side quest marker while a job is on offer. You can turn a job down and take it later. A hand-in option only shows while you carry the item. The jobs start on saves made before the mod was installed. Everything is translated into every language the game supports.",
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
