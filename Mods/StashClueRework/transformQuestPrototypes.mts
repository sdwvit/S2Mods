import { QuestPrototype, Struct } from "s2cfgtojson";
import { QuestSID } from "./injectMassiveRNGQuestNodes.mts";

let transformQuestPrototypesOnce = false;

export function transformQuestPrototypes() {
  if (transformQuestPrototypesOnce) {
    return;
  }
  transformQuestPrototypesOnce = true;
  const quest = new Struct() as QuestPrototype;
  quest.SID = QuestSID;
  quest.__internal__.isRoot = true;
  quest.__internal__.rawName = quest.SID;
  quest.DLC = "None";
  return quest;
}

transformQuestPrototypes.files = ["/QuestPrototypes/BodyParts_Malahit.cfg"];
