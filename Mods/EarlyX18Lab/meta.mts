import type { MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype, QuestNodePrototypeTechnical } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

async function transformQuestNodePrototypes(struct: QuestNodePrototype) {
  if (struct.SID === "Garbage_L_Container_SQ103") {
    const fork = struct.fork();

    fork.Launchers = getLaunchers([
      { SID: "Garbage_L_OnTickEvent_SQ103Start" },
      { SID: "Garbage_L_SetJournal_SQ103_Stage_GetToLab", Excluding: true },
    ]);

    return fork;
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
  changenote: "Roll back to the simplest variant",
  structTransformers: [transformQuestNodePrototypes],
};
