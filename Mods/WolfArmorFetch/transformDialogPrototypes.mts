import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getDialogPhrase, getWaitForReply } from "../../src/getDialogPhrase.mts";
import { writeWolfArmorFetchLocalization } from "./writeLocalization.mts";
import { chainSID, lineSID, nextNodeSID, nextSID, pickerSID, walk, type Branch, type Label, type Line, type Topic } from "./dialog.mts";
import { ALL_TOPICS } from "./topics.mts";
import { allOf, itemCount } from "./conditions.mts";

let once = false;

/** The conditions an option shows on: carrying `needsItem`, and all of `conditions`. */
function optionConditions(label: Label) {
  const all = [...(label.needsItem ? [itemCount(label.needsItem)] : []), ...(label.conditions ?? [])];
  return all.length ? allOf(all) : undefined;
}

/**
 * A line's `DialogActions`: paying the player `money` coupons as it plays - vanilla's in-dialog payment
 * (E07_SQ01_Dialog_Farmacevt_YouDidIt sets the same action in both lists, with no quest node paying) -
 * and its own `actions`. Vanilla sets each action in both lists.
 */
function lineActions(line: Line) {
  const actions = [
    ...(line.money
      ? [
          new Struct({
            DialogAction: "EDialogAction::GetMoney",
            DialogActionParam: new Struct({ VariableType: "EGlobalVariableType::Int", VariableValue: line.money }),
          }),
        ]
      : []),
    ...(line.actions ?? []),
  ];
  if (!actions.length) return {};
  const list = () => {
    const s = new Struct();
    actions.forEach((a) => s.addNode(a.clone()));
    return s;
  };
  return { DialogActions: list(), DialogAnswerActions: list() };
}

/**
 * A label's lines as a chain of `DialogPrototypes`, each line's SID being its dialog-asset phrase SID
 * (and so its `TextToolPhraseSID`). The last line goes on to the label's `next`, or ends the dialog.
 */
function labelLines(topic: Topic, label: Label) {
  return label.lines.map((line, i) => {
    const sid = lineSID(topic, label, i);
    const next = i < label.lines.length - 1 ? lineSID(topic, label, i + 1) : nextSID(topic, label);
    const phrase = getDialogPhrase(sid, chainSID(topic), line.by === "npc" ? 0 : -1, [{ sid: next, terminate: !!label.terminate && i === label.lines.length - 1 }], sid);
    // A comment's lines play through, as vanilla's comment phrases.
    if (topic.comment) Object.assign(phrase, { Unskippable: true, MainReply: false });
    return Object.assign(phrase, lineActions(line));
  });
}

/** A branch as vanilla's dialog `If` node (RSQ05_Dialog_Sich_C11_Finish_If_1). */
const branchNode = (topic: Topic, branch: Branch) =>
  new Struct({
    __internal__: { rawName: pickerSID(topic, branch), isRoot: true },
    SID: pickerSID(topic, branch),
    DialogChainPrototypeSID: chainSID(topic),
    DialogMemberIndex: -1,
    NextDialogOptions: new Struct({
      True: new Struct({ Conditions: allOf(branch.when), NextDialogSID: nextNodeSID(topic, branch.then), Terminate: false }),
      False: new Struct({ NextDialogSID: nextNodeSID(topic, branch.else), Terminate: false }),
    }),
    VisibleOnFailedCondition: true,
    MainReply: true,
    NodePrototypeVersion: 1,
  });

/** Every label's lines, a reply picker for each choice point, and an `If` node for each branch. */
function topicPrototypes(topic: Topic) {
  const { labels, pickers, branches } = walk(topic);
  return [
    ...branches.map((branch) => branchNode(topic, branch)),
    ...labels.flatMap((label) => labelLines(topic, label)),
    ...pickers.map((picker) =>
      getWaitForReply(
        pickerSID(topic, picker),
        chainSID(topic),
        picker.choices.map((choice) => ({
          sid: lineSID(topic, choice, 0),
          ...(optionConditions(choice) ? { conditions: optionConditions(choice) } : {}),
          ...(choice.info ? { mainReply: false, excludeBy: [lineSID(topic, choice, 0)] } : {}),
        })),
      ),
    ),
  ];
}

export const transformDialogPrototypes: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;
  writeWolfArmorFetchLocalization();
  return ALL_TOPICS.flatMap(topicPrototypes);
};
transformDialogPrototypes.files = ["/DialogPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
