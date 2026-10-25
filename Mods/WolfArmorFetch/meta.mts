import type { MetaType } from "../../src/meta-type.mts";

import { transformQuestRegistration } from "./transformQuestRegistration.mts";
import { transformQuestNodes } from "./transformQuestNodes.mts";
import { transformJournal } from "./transformJournal.mts";
import { transformDialogChains } from "./transformDialogChains.mts";
import { transformDialogPrototypes } from "./transformDialogPrototypes.mts";
import { transformRewards } from "./transformRewards.mts";
import { transformRootgraph } from "./transformRootgraph.mts";
import { ON_WORLD_LOAD, transformRookieVillageHub } from "./transformRookieVillageHub.mts";
import { transformSkadovskHub } from "./transformSkadovskHub.mts";
import {
  transformCoverGlobalVariables,
  transformCoverMeshGenerators,
  transformCoverNotes,
  transformCoverNPCPrototypes,
  transformCoverObjPrototypes,
  transformCoverQuestItems,
  writeCoverSpawnActors,
} from "./coverPrototypes.mts";

export const meta: MetaType = {
  description: `
Wolf's Jobs
[hr][/hr]
Wolf in Rookie Village has three jobs for you.[h1][/h1]
The first is personal: Wolf has picked up a lead on an old score and needs you to fetch something for him.[h1][/h1]
The second follows soon after and builds on what the first one turned up.[h1][/h1]
The third takes you to Zaton, where you'll have to talk your way through a meeting. How well you're prepared changes your odds.[h1][/h1]
Works on existing saves. Dialogs and journal text are translated into every language the game supports.[h1][/h1]
`,
  changenote: "Fixed Wolf's last job not being offered after its marker appeared, a missing line along the way, and a fight starting early on saves where Skif is at odds with a faction.",
  // Saves where Wolf spawned before the mod was installed never re-run his topic triggers.
  gameStartCommand: `XStartQuestNodeBySID ${ON_WORLD_LOAD}`,
  structTransformers: [
    transformQuestRegistration,
    transformQuestNodes,
    transformJournal,
    transformDialogChains,
    transformDialogPrototypes,
    transformRewards,
    transformRootgraph,
    transformRookieVillageHub,
    transformSkadovskHub,
    transformCoverObjPrototypes,
    transformCoverNPCPrototypes,
    transformCoverMeshGenerators,
    transformCoverQuestItems,
    transformCoverNotes,
    transformCoverGlobalVariables,
  ],
  onFinish: writeCoverSpawnActors,
};
