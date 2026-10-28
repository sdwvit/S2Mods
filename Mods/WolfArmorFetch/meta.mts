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

/**
 * Wolf's Jobs: three jobs from Wolf in Rookie Village, voiced in English and Ukrainian.
 *
 * Stats as of the 2026-10-25 release:
 * - Download (Steam/mod.io): 21 MB, 11 files. Xbox zip (loose, uncooked): 119 MB.
 * - `raw/`: 1.1 GB, 356 files (337 `.uasset`, 17 `.cfg`). Source: 22 `.mts` files, ~7,500 lines.
 * - Voice: 278 lines, 139 per language (Skif 53, Wolf 53, Ward soldiers 27, Sultan 4, Hook 2).
 * - Text: journal and dialogs in every language the game supports.
 *
 * Timeline:
 * - First commit 2026-03-18 (the first job); release 2026-10-25, about 7 months later.
 * - Commits on 10 different days, 15 touching the mod. The bulk landed 2026-10-12..21: the second and
 *   third jobs, voice lines with lip-sync, a second dialog branch and the HeadlessArmors-aware reward.
 * - 2026-10-25: ~1.5 h (13:00-14:30) from the first "no dialog on an existing save" report to release.
 *   Three fix commits and five Steam publishes. Seven bugs found, mostly by starting quest nodes one at
 *   a time in the running game: the world-load check, the quests not running, the hand-paid Falcon,
 *   Hook's line trigger, hostile dealers, load timing, and a timer race on the third job's offer.
 */
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
  changenote: "Wolf's first job can now be finished on saves where Skif already got rid of the rifle it asks for.",
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
