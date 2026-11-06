import type { QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { root } from "./lairMarker.mts";
import { TEST_QUEST_SIDS } from "./transformQuestNodePrototypes.mts";

let once = false;

/** An unregistered QuestSID can never be started. */
export const transformQuestPrototypes: StructTransformer<QuestPrototype> = () => {
  if (once) return null;
  once = true;
  return TEST_QUEST_SIDS.map((SID) => root<QuestPrototype>(SID, { DLC: "None" }));
};

transformQuestPrototypes.files = ["/QuestPrototypes/rootgraph.cfg"];
