import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype, QuestNodePrototypeCondition, QuestNodePrototypeSetGlobalVariable, QuestNodePrototypeSetItemGenerator } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getConditions, getLaunchers } from "../../src/struct-utils.mts";
import { QuestDataTableByQuestSID, QuestDataTableEntry } from "./rewardFormula.mts";
import { logger } from "../../src/logger.mts";
import { recurringQuestsFilenames } from "../StashClueRework/transformQuestNodePrototypes.mts";

/**
 * Removes timeout for repeating quests.
 */
export const transformQuestNodePrototypes: StructTransformer<QuestNodePrototype> = async (struct, context) => {
  let promises: Promise<QuestNodePrototype[] | QuestNodePrototype>[] = [];
  const fork = struct.fork() as QuestNodePrototypeSetItemGenerator;

  // applies only to recurring quests
  if (recurringQuestsFilenames.some((p) => context.filePath.includes(p))) {
    if (struct.NodeType === "EQuestNodeType::SetItemGenerator") {
      if (struct.ItemGeneratorSID.includes("reward_var")) {
        promises.push(Promise.resolve(replaceRewards(struct, fork)));
      }
    }
  }

  const res = await Promise.all(promises).then((results) => results.flat());
  if ((fork as any).entries().length) {
    res.push(fork);
  }

  return res;
};

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/"];
transformQuestNodePrototypes.contents = ["EQuestNodeType::SetItemGenerator"];
transformQuestNodePrototypes.contains = true;

const oncePerQuestSID = new Set<string>();

function replaceRewards(struct: QuestNodePrototypeSetItemGenerator, fork: QuestNodePrototypeSetItemGenerator) {
  const extraStructs: QuestNodePrototype[] = [];
  const questVariants = QuestDataTableByQuestSID[struct.QuestSID] || [];

  // For quests with exactly one reward variant, avoid redirecting through a
  // condition chain and patch the original reward node directly.
  if (questVariants.length === 1) {
    fork.ItemGeneratorSID = questVariants[0]["Reward Gen SID"];
    return extraStructs;
  }

  if (!oncePerQuestSID.has(struct.QuestSID)) {
    oncePerQuestSID.add(struct.QuestSID);
    logger.info(`Replacing rewards for quest SID: ${struct.QuestSID}`);
    questVariants.forEach((qv) => {
      const newRewardNode = getNewRewardNode(qv, struct);
      extraStructs.push(newRewardNode);

      if (!qv["Variant Quest Node SID"].trim()) {
        logger.warn(`Missing "Variant Quest Node SID" for qv #${qv["#"]}`);
        return;
      }

      newRewardNode.Launchers = getLaunchers([{ SID: getConditionNodeSID(qv), Name: "" }]);
      const varName = `${qv.Vendor.replace(/\W/g, "")}_latest_quest_variant`;
      const setLatestQuestVarNode = getLatestQuestVarNodeSetter(varName, qv, struct.QuestSID);
      const conditionNode = getConditionNode(varName, qv, struct);

      extraStructs.push(setLatestQuestVarNode);
      extraStructs.push(conditionNode);
    });
  }
  fork.ItemGeneratorSID = "empty";
  return extraStructs;
}

function getLatestQuestVarNodeSetter(varName: string, qv: QuestDataTableEntry, questSID: string) {
  const s = new Struct({}) as QuestNodePrototypeSetGlobalVariable;
  s.SID = `Set_${varName}_${qv["#"]}`;
  s.QuestSID = questSID;
  s.NodeType = "EQuestNodeType::SetGlobalVariable";
  s.GlobalVariablePrototypeSID = varName;
  s.ChangeValueMode = "EChangeValueMode::Set";
  s.VariableValue = qv["#"];
  s.Launchers = getLaunchers([{ SID: qv["Variant Quest Node SID"].trim(), Name: "" }]);

  s.__internal__.isRoot = true;
  s.__internal__.rawName = s.SID;
  return s;
}

function getNewRewardNode(qv: QuestDataTableEntry, struct: QuestNodePrototype) {
  const s = new Struct() as QuestNodePrototypeSetItemGenerator;
  s.SID = `${qv["Reward Gen SID"]}_SetItemGenerator`;
  s.QuestSID = struct.QuestSID;
  s.NodeType = "EQuestNodeType::SetItemGenerator";
  s.Launchers = getLaunchers([{ SID: struct.SID, Name: "" }]);
  s.TargetQuestGuid = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  s.ReplaceInventory = false;
  s.EquipItems = false;
  s.ItemGeneratorSID = qv["Reward Gen SID"];
  s.__internal__.isRoot = true;
  s.__internal__.rawName = s.SID;
  return s;
}

function getConditionNodeSID(qv: QuestDataTableEntry) {
  return `${qv["Reward Gen SID"]}_Condition`;
}

function getConditionNode(varName: string, qv: QuestDataTableEntry, struct: QuestNodePrototype) {
  const s = new Struct() as QuestNodePrototypeCondition;
  s.SID = getConditionNodeSID(qv);
  s.__internal__.rawName = s.SID;
  s.__internal__.isRoot = true;
  s.NodeType = "EQuestNodeType::Condition";
  s.QuestSID = struct.QuestSID;
  s.Conditions = getConditions([
    {
      ConditionType: "EQuestConditionType::GlobalVariable",
      ConditionComparance: "EConditionComparance::Equal",
      GlobalVariablePrototypeSID: varName,
      ChangeValueMode: "EChangeValueMode::Set",
      VariableValue: qv["#"],
    },
  ]);
  s.Launchers = getLaunchers([{ SID: struct.SID, Name: "" }]);
  return s;
}
