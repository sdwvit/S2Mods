import { Struct } from "s2cfgtojson";
import type { QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { allSubQuests } from "./local.consts.mts";

let once = false;

export const transformQuestPrototypes: StructTransformer<QuestPrototype> = async () => {
  if (once) return;
  once = true;

  return allSubQuests.map((subQuest) => {
    const sid = `MoreSideQuestOptions_${subQuest}`;
    return new Struct({
      __internal__: { rawName: sid, isRoot: true },
      SID: sid,
      DLC: "None",
    }) as QuestPrototype;
  });
};

transformQuestPrototypes.files = ["/QuestPrototypes/A-life_interrupts.cfg"];
