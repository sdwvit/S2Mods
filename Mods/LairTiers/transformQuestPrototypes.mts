import { Struct } from "s2cfgtojson";
import type { QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { LAIR_TIER_QUEST_SIDS } from "./lairTierQuestNodes.mts";

let once = false;

/** Registers the LairTiers quest and its switch quests; an unregistered QuestSID can never be started. */
export const transformQuestPrototypes: StructTransformer<QuestPrototype> = () => {
  if (once) return;
  once = true;

  return LAIR_TIER_QUEST_SIDS.map(
    (SID) =>
      new Struct({
        __internal__: { rawName: SID, isRoot: true },
        SID,
        DLC: "None",
      }) as QuestPrototype,
  );
};
transformQuestPrototypes.files = ["/QuestPrototypes/rootgraph.cfg"];
