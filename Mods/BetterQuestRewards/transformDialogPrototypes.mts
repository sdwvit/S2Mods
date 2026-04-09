import { Struct } from "s2cfgtojson";
import type { DialogPrototype } from "s2cfgtojson";

import type { StructTransformer } from "../../src/meta-type.mts";
import { QuestDataTableByDialogSID, rewardFormula } from "./questData.mts";

/**
 * Show the correct money reward for repeatable quests
 */
export const transformDialogPrototypes: StructTransformer<DialogPrototype> = async (struct, context) => {
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
];

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
