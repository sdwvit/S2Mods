import type { MetaType } from "../../src/meta-type.mts";
import type {
  QuestNodePrototype,
  QuestNodePrototypeConsoleCommand,
  QuestNodePrototypeOnJournalQuestEvent,
  QuestNodePrototypeTechnical,
} from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { getLaunchers, rerouteQuestNode } from "../../src/struct-utils.mts";

async function transformQuestNodePrototypes(struct: QuestNodePrototype) {
  if (struct.SID === "Garbage_L_Container_SQ103") {
    const fork = struct.fork();

    const resetQuest = struct.fork() as QuestNodePrototypeConsoleCommand;
    resetQuest.SID = struct.SID + "_Reset";
    resetQuest.__internal__.rawName = resetQuest.SID;
    resetQuest.NodeType = "EQuestNodeType::ConsoleCommand";
    resetQuest.QuestSID = struct.QuestSID;
    resetQuest.Launchers = getLaunchers([
      { SID: "Garbage_L_OnTickEvent_SQ103Start" },
      { SID: "Garbage_L_SetJournal_SQ103_Stage_GetToLab", Excluding: true },
    ]);
    resetQuest.ConsoleCommand = "XResetQuestBySID SQ103";

    fork.Launchers = getLaunchers([{ SID: resetQuest.SID }]);

    return [resetQuest, fork];
  }

  if (struct.SID === "SQ103_OnJournalQuestEvent_E08_MQ01_GetToMalahit") {
    const fork = struct.fork() as QuestNodePrototypeTechnical;
    fork.__internal__.bpatch = false;
    fork.SID = struct.SID;
    fork.NodeType = "EQuestNodeType::Technical";
    fork.QuestSID = struct.QuestSID;
    fork.StartDelay = 0.0;
    return fork;
  }
}
transformQuestNodePrototypes.files = ["Garbage_L.cfg", "SQ103.cfg"];

export const meta: MetaType = {
  description: `
Unblocks the X18 Lab side quest (SQ103) from the later main-quest gate.
Normally Diod's radio call only fires in the narrow window between completing E03_MQ06 and starting E08_MQ01.
`,
  changenote: "Force reset SQ103 before triggering it. Also remove extra exclusion trigger.",
  structTransformers: [transformQuestNodePrototypes],
};
