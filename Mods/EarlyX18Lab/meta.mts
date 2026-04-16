import type { MetaType } from "../../src/meta-type.mts";
import type { QuestNodePrototype, QuestNodePrototypeIf } from "s2cfgtojson";
import { Struct } from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";

async function transformQuestNodePrototypes(
  struct: QuestNodePrototype,
  context: MetaContext<QuestNodePrototype>,
) {
  // Remove main quest conditions from the SQ103 container so the quest starts on any tick
  if (struct.SID === "Garbage_L_Container_SQ103") {
    const fork = struct.fork();
    fork.Launchers = struct.Launchers.fork();

    // New If node: guard against re-triggering when SQ103 is already active
    const ifNode = new Struct() as QuestNodePrototypeIf;
    ifNode.SID = "Garbage_L_If_SQ103_NotActive_EarlyX18Lab";
    ifNode.QuestSID = struct.QuestSID;
    ifNode.NodeType = "EQuestNodeType::If";
    ifNode.Repeatable = true;
    ifNode.Launchers = getLaunchers([{ SID: "Garbage_L_OnTickEvent_SQ103Start" }]);
    ifNode.Conditions = getConditions([
      {
        ConditionType: "EQuestConditionType::JournalState",
        ConditionComparance: "EConditionComparance::NotEqual",
        JournalEntity: "EJournalEntity::Quest",
        JournalState: "EJournalState::Active",
        JournalQuestSID: "SQ103",
      },
    ]);
    ifNode.__internal__.isRoot = true;
    ifNode.__internal__.rawName = ifNode.SID;

    // Launcher 2: require the If node to pass (SQ103 not already active)
    const launcher2 = new Struct() as any;
    launcher2.Excluding = false;
    launcher2.Connections = new Struct() as any;
    const conn2 = new Struct() as any;
    conn2.SID = ifNode.SID;
    conn2.Name = "True";
    launcher2.Connections.addNode(conn2);
    fork.Launchers.addNode(launcher2, ifNode.SID);

    // Pin_0: only fire when SQ103 is NOT active (no ConditionCheckType)
    const pin0 = context.structsById["Garbage_L_Container_SQ103_Pin_0"].fork();
    const pin0Conditions = new Struct() as any;
    const pin0ConditionsItem = new Struct() as any;
    pin0ConditionsItem.addNode(
      new Struct({
        ConditionType: "EQuestConditionType::JournalState",
        ConditionComparance: "EConditionComparance::NotEqual",
        JournalEntity: "EJournalEntity::Quest",
        JournalState: "EJournalState::Active",
        JournalQuestSID: "SQ103",
      }),
    );
    pin0Conditions.addNode(pin0ConditionsItem);
    pin0.Conditions = pin0Conditions;

    // Pin_2: only fire when SQ103 IS active
    const pin2 = context.structsById["Garbage_L_Container_SQ103_Pin_2"].fork();
    pin2.Conditions = getConditions([
      {
        ConditionType: "EQuestConditionType::JournalState",
        ConditionComparance: "EConditionComparance::Equal",
        JournalEntity: "EJournalEntity::Quest",
        JournalState: "EJournalState::Active",
        JournalQuestSID: "SQ103",
      },
    ]);

    return [fork, ifNode, pin0, pin2];
  }
}
transformQuestNodePrototypes.files = ["GameLite/GameData/QuestNodePrototypes/Garbage_L.cfg"];

export const meta: MetaType = {
  description: `
Removes the main quest progression gate from the X18 Lab side quest (SQ103).
Normally this quest only becomes available after completing E03_MQ06 and before E08_MQ01 starts.
With this mod, Diod's radio call can trigger at any point in the game.
`,
  changenote: "Fix quest conditions to properly free SQ103 from main quest gates",
  structTransformers: [transformQuestNodePrototypes],
};
