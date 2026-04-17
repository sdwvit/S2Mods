import type { MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";

function buildLauncher(excluding: boolean, connections: { SID: string; withName?: boolean }[]) {
  const launcher = new Struct() as any;
  launcher.Excluding = excluding;
  launcher.Connections = new Struct() as any;
  for (const c of connections) {
    const conn = new Struct() as any;
    conn.SID = c.SID;
    if (c.withName) {
      conn.Name = "";
    }
    launcher.Connections.addNode(conn);
  }
  return launcher;
}

async function transformQuestNodePrototypes(
  struct: QuestNodePrototype,
  context: MetaContext<QuestNodePrototype>,
) {
  if (struct.SID === "Garbage_L_Container_SQ103") {
    const fork = struct.fork();
    fork.Launchers = new Struct() as any;
    fork.Launchers.addNode(
      buildLauncher(false, [
        { SID: "Garbage_L_OnTickEvent_SQ103Start", withName: true },
        { SID: "Garbage_L_Container_SQ103_Pin_0" },
      ]),
    );
    fork.Launchers.addNode(
      buildLauncher(true, [
        { SID: "Garbage_L_Container_SQ103_Pin_2" },
        { SID: "Garbage_L_OnTickEvent_SQ103Start", withName: true },
      ]),
    );
    fork.Launchers.addNode(
      buildLauncher(true, [{ SID: "Garbage_L_SetJournal_SQ103_Stage_GetToLab", withName: true }]),
    );

    const pin0 = context.structsById["Garbage_L_Container_SQ103_Pin_0"].fork();
    const pin0Conditions = new Struct() as any;
    const pin0ConditionsItem = new Struct() as any;
    pin0ConditionsItem.addNode(
      new Struct({
        ConditionType: "EQuestConditionType::JournalState",
        ConditionComparance: "EConditionComparance::Equal",
        JournalEntity: "EJournalEntity::Quest",
        JournalState: "EJournalState::Finished",
        JournalQuestSID: "E03_MQ06",
      }),
    );
    pin0Conditions.addNode(pin0ConditionsItem);
    pin0.Conditions = pin0Conditions;

    const setJournalPin0 = context.structsById["Garbage_L_SetJournal_SQ103_Stage_GetToLab_Pin_0"].fork();
    const setJournalPin0Conditions = new Struct() as any;
    const setJournalPin0ConditionsItem = new Struct() as any;
    setJournalPin0ConditionsItem.addNode(
      new Struct({
        ConditionType: "EQuestConditionType::JournalState",
        ConditionComparance: "EConditionComparance::Equal",
        JournalEntity: "EJournalEntity::Quest",
        JournalState: "EJournalState::Active",
        JournalQuestSID: "SQ103",
      }),
    );
    setJournalPin0Conditions.addNode(setJournalPin0ConditionsItem);
    setJournalPin0.Conditions = setJournalPin0Conditions;

    return [fork, pin0, setJournalPin0];
  }
}
transformQuestNodePrototypes.files = ["GameLite/GameData/QuestNodePrototypes/Garbage_L.cfg"];

export const meta: MetaType = {
  description: `
Unblocks the X18 Lab side quest (SQ103) from the later main-quest gate.
Normally Diod's radio call only fires in the narrow window between completing E03_MQ06 and starting E08_MQ01.
With this mod, E03_MQ06 is still required, but the upper E08_MQ01 gate is lifted so the call fires any time afterwards.
`,
  changenote: "Fix missing triggers when entering X-18 lab",
  structTransformers: [transformQuestNodePrototypes],
};
