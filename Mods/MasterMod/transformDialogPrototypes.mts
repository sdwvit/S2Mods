import { DialogPrototype, Struct } from "s2cfgtojson";

import { StructTransformer } from "../../src/meta-type.mts";
import { deepMerge } from "../../src/deep-merge.mts";
import { QuestDataTableByDialogSID, rewardFormula } from "./rewardFormula.mts";
import { alwaysShowAllMutantQuestPartsDialog } from "../MoreSideQuestOptions/meta.mts";

const MALACHITE_BRIBE = rewardFormula(50000).reduce((a, b) => a + b, 0) / 2;

/**
 * Show the correct money reward for repeatable quests
 */
export const transformDialogPrototypes: StructTransformer<DialogPrototype> = async (struct, context) => {
  if (struct.SID === "Malahit_Hub_DialogueOnEntrance_Bribe_62758") {
    return adjustMalahitBribe(struct);
  }
  if (struct.SID === "Malahit_Hub_DialogueOnEntrance_WaitForReply") {
    return adjustMalahitBribeDialogValue(struct);
  }

  if (alwaysShowAllMutantQuestPartsDialog.files.some((f) => context.filePath.endsWith(f))) {
    return alwaysShowAllMutantQuestPartsDialog(struct);
  }

  const fork = adjustQuestRewards(struct);

  if (fork.entries().length) {
    return fork;
  }
};
transformDialogPrototypes.files = [
  "/DialogPrototypes/RSQ10_Dialog_Harpy_RSQ.cfg",
  "/DialogPrototypes/RSQ09_Dialog_Spica_RSQ.cfg",
  "/DialogPrototypes/RSQ08_Dialog_Barmen_RSQ.cfg",
  "/DialogPrototypes/RSQ07_Dialog_Barmen_RSQ.cfg",
  "/DialogPrototypes/RSQ06_Dialog_Sidorovich_RSQ.cfg",
  "/DialogPrototypes/RSQ05_Dialog_Sich_RSQ.cfg",
  "/DialogPrototypes/RSQ04_Dialog_Drabadan_RSQ.cfg",
  "/DialogPrototypes/RSQ01_Dialog_Warlock_RSQ.cfg",
  "/DialogPrototypes/Malahit_Hub_DialogueOnEntrance.cfg",
  "/DialogPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg",
  "/DialogPrototypes/EQ197_QD_Orders.cfg",
];

function adjustMalahitBribe(struct: DialogPrototype) {
  const fork = struct.fork();

  return deepMerge(fork, {
    DialogActions: new Struct({
      "0": new Struct({ DialogActionParam: new Struct({ VariableValue: MALACHITE_BRIBE }) }),
    }),
    DialogAnswerActions: new Struct({
      "0": new Struct({ DialogActionParam: new Struct({ VariableValue: MALACHITE_BRIBE }) }),
    }),
    TopicAvailabilityConditions: new Struct({
      "0": new Struct({ "0": new Struct({ Money: new Struct({ VariableValue: MALACHITE_BRIBE }) }) }),
    }),
  }).fork(true);
}

function adjustMalahitBribeDialogValue(struct: DialogPrototype) {
  const fork = struct.fork();
  return deepMerge(fork, {
    NextDialogOptions: new Struct({
      "2": new Struct({
        Conditions: new Struct({
          0: new Struct({ 0: new Struct({ Money: new Struct({ VariableValue: MALACHITE_BRIBE }) }) }),
        }),
      }),
    }),
  }).fork(true);
}

function adjustQuestRewards(struct: DialogPrototype) {
  const fork = struct.fork();

  const mapper = ([_k, v]) => {
    if (!(v.DialogAction === "EDialogAction::ShowMoney" && typeof v.DialogActionParam === "object")) {
      return;
    }
    const qvs = QuestDataTableByDialogSID[struct.SID];
    if (!qvs) {
      return;
    }
    const DialogActionParam = new Struct({
      VariableValue:
        rewardFormula(
          Math.round(
            qvs.reduce((mem, qvs) => {
              return mem + parseInt(qvs["Suggested Reward"], 10);
            }, 0) / qvs.length,
          ),
        ).reduce((a, b) => a + b, 0) / 2,
    });
    DialogActionParam.__internal__.bpatch = true;
    return Object.assign(v.fork(), { DialogActionParam });
  };

  const DialogActions = struct.DialogActions?.map?.(mapper);
  const DialogAnswerActions = struct.DialogAnswerActions?.map?.(mapper);
  if (DialogActions && DialogActions.entries().length) {
    DialogActions.__internal__.bpatch = true;
    fork.DialogActions = DialogActions;
  }
  if (DialogAnswerActions && DialogAnswerActions.entries().length) {
    DialogAnswerActions.__internal__.bpatch = true;
    fork.DialogAnswerActions = DialogAnswerActions;
  }

  return fork;
}
