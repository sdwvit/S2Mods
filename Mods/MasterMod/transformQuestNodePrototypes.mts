import { QuestNodePrototype, Struct } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";
import { RSQLessThan3QuestNodesSIDs, RSQRandomizerQuestNodesSIDs, RSQSetDialogQuestNodesSIDs } from "../../src/consts.mts";
import { QuestDataTableByQuestSID } from "./rewardFormula.mts";
import { logger } from "../../src/logger.mts";
import { recurringQuestsFilenames } from "../StashClueRework/meta.mts";

/**
 * Removes timeout for repeating quests.
 */
export const transformQuestNodePrototypes: EntriesTransformer<QuestNodePrototype> = async (struct, context) => {
  let promises: Promise<QuestNodePrototype[] | QuestNodePrototype>[] = [];
  // applies to all quest nodes that add items (i.e., stash clues)
  const fork = struct.fork();

  // applies only to recurring quests
  if (recurringQuestsFilenames.some((p) => context.filePath.includes(p))) {
    if (struct.NodeType === "EQuestNodeType::SetItemGenerator") {
      if (struct.ItemGeneratorSID.includes("reward_var")) {
        promises.push(Promise.resolve(replaceRewards(struct, fork)));
      }
    }

    if (struct.SID === "RSQ08_C01_K_M_Random_3") {
      fork.PinWeights = struct.PinWeights.fork();
      fork.PinWeights[0] = 0.5;
    }
    if (struct.SID === "RSQ08_C01_K_M_Technical_STL4939_Pin_0") {
      fork.Conditions = getConditions([
        {
          ConditionType: "EQuestConditionType::NodeState",
          ConditionComparance: "EConditionComparance::Equal",
          TargetNode: "RSQ08_C01_K_M_SetDialog_RSQ08_Dialog_Barmen_C01_Finish",
          NodeState: "EQuestNodeState::Finished",
        },
      ]);
      fork.Conditions.__internal__.bpatch = false;
    }

    if (RSQLessThan3QuestNodesSIDs.has(struct.SID)) {
      const total = context.structsById[RSQRandomizerQuestNodesSIDs.find((key) => !!context.structsById[key])].OutputPinNames.entries().length;
      fork.Conditions ||= struct.Conditions.fork();
      fork.Conditions[0] ||= struct.Conditions[0].fork();
      fork.Conditions[0][0] ||= struct.Conditions[0][0].fork();
      fork.Conditions[0][0].VariableValue = total;
    }
    if (RSQSetDialogQuestNodesSIDs.has(struct.SID)) {
      let connectionIndex: string;
      const [launcherIndex] = struct.Launchers.entries().find((e) => {
        return e[1].Connections.entries().find((e1) => {
          connectionIndex = e1[0];
          return RSQLessThan3QuestNodesSIDs.has(e1[1].SID);
        });
      });
      fork.Launchers ||= struct.Launchers.fork();
      fork.Launchers[launcherIndex] ||= struct.Launchers[launcherIndex].fork();
      fork.Launchers[launcherIndex].Connections ||= struct.Launchers[launcherIndex].Connections.fork();
      fork.Launchers[launcherIndex].Connections[connectionIndex] ||= struct.Launchers[launcherIndex].Connections[connectionIndex].fork();
      fork.Launchers[launcherIndex].Connections[connectionIndex].Name = "True";
    }
  }

  const res = await Promise.all(promises).then((results) => results.flat());
  if (fork.entries().length) {
    res.push(fork);
  }

  return res;
};

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/"];
transformQuestNodePrototypes.contents = [
  "EQuestNodeType::ItemAdd",
  "EQuestNodeType::SetItemGenerator",
  "InGameHours",
  ...RSQLessThan3QuestNodesSIDs,
  "RookieVillage_Hub_OnNPCCreateEvent_BP_NPC_RookieVillageGuider",
];
transformQuestNodePrototypes.contains = true;

const oncePerQuestSID = new Set<string>();

function replaceRewards(struct: QuestNodePrototype, fork: QuestNodePrototype) {
  const extraStructs: QuestNodePrototype[] = [];

  if (!oncePerQuestSID.has(struct.QuestSID)) {
    oncePerQuestSID.add(struct.QuestSID);
    logger.info(`Replacing rewards for quest SID: ${struct.QuestSID}`);
    const questVariants = QuestDataTableByQuestSID[struct.QuestSID];
    questVariants.forEach((qv) => {
      const newRewardNode = struct.fork(true);
      delete newRewardNode.__internal__.bpatch;
      delete newRewardNode.__internal__.refurl;
      newRewardNode.SID = `${qv["Reward Gen SID"]}_SetItemGenerator`;
      newRewardNode.__internal__.rawName = newRewardNode.SID;
      newRewardNode.ItemGeneratorSID = qv["Reward Gen SID"];
      newRewardNode.QuestSID = struct.QuestSID;
      newRewardNode.Launchers = getLaunchers([{ SID: struct.SID, Name: "" }]);
      extraStructs.push(newRewardNode);

      if (!qv["Variant Quest Node SID"].trim()) {
        logger.warn(`Missing "Variant Quest Node SID" for qv #${qv["#"]}`);
        return;
      }
      const varName = `${qv.Vendor.replace(/\W/g, "")}_latest_quest_variant`;
      const setLatestQuestVarNode = new Struct({
        SID: `Set_${varName}_${qv["#"]}`,
        QuestSID: struct.QuestSID,
        NodeType: "EQuestNodeType::SetGlobalVariable",
        GlobalVariablePrototypeSID: varName,
        ChangeValueMode: "EChangeValueMode::Set",
        VariableValue: qv["#"],
        Launchers: getLaunchers([{ SID: qv["Variant Quest Node SID"].trim(), Name: "" }]),
      }) as QuestNodePrototype;
      setLatestQuestVarNode.__internal__.rawName = setLatestQuestVarNode.SID;
      setLatestQuestVarNode.__internal__.isRoot = true;
      extraStructs.push(setLatestQuestVarNode);
      const conditionNode = new Struct() as QuestNodePrototype;
      conditionNode.SID = `${qv["Reward Gen SID"]}_Condition`;
      conditionNode.__internal__.rawName = conditionNode.SID;
      conditionNode.__internal__.isRoot = true;
      conditionNode.NodeType = "EQuestNodeType::Condition";
      conditionNode.QuestSID = struct.QuestSID;
      conditionNode.Conditions = getConditions([
        {
          ConditionType: "EQuestConditionType::GlobalVariable",
          ConditionComparance: "EConditionComparance::Equal",
          GlobalVariablePrototypeSID: varName,
          ChangeValueMode: "EChangeValueMode::Set",
          VariableValue: qv["#"],
        },
      ]);
      conditionNode.Launchers = getLaunchers([{ SID: struct.SID, Name: "" }]);
      newRewardNode.Launchers = getLaunchers([{ SID: conditionNode.SID, Name: "" }]);
      extraStructs.push(conditionNode);
    });
  }
  fork.ItemGeneratorSID = "empty";
  return extraStructs;
}
