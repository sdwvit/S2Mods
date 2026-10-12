import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getDialogPhrase, getWaitForReply } from "../../src/getDialogPhrase.mts";
import { writeWolfArmorFetchLocalization } from "./writeLocalization.mts";
import { TOPICS, chainSID, lineSID, nextSID, pickerSID, walk, type Label, type Topic } from "./dialog.mts";

let once = false;

const PLAYER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** An option that only shows while the player carries `item` (worn or in the backpack). */
function hasItem(item: string) {
  return new Struct({
    0: new Struct({
      0: new Struct({
        ConditionType: "EQuestConditionType::ItemInInventory",
        ConditionComparance: "EConditionComparance::GreaterOrEqual",
        TargetCharacter: PLAYER,
        ItemPrototypeSID: new Struct({ VariableType: "EGlobalVariableType::String", VariableValue: item }),
        ItemsCount: new Struct({ VariableType: "EGlobalVariableType::Int", VariableValue: 1 }),
        WithEquipped: true,
        WithInventory: true,
      }),
    }),
  });
}

/**
 * Pays the player `amount` coupons as the phrase plays - vanilla's in-dialog payment
 * (E07_SQ01_Dialog_Farmacevt_YouDidIt sets the same action in both lists, with no quest node paying).
 */
function getMoney(amount: number) {
  const action = () =>
    new Struct({
      0: new Struct({
        DialogAction: "EDialogAction::GetMoney",
        DialogActionParam: new Struct({ VariableType: "EGlobalVariableType::Int", VariableValue: amount }),
      }),
    });
  return { DialogActions: action(), DialogAnswerActions: action() };
}

/**
 * A label's lines as a chain of `DialogPrototypes`, each line's SID being its dialog-asset phrase SID
 * (and so its `TextToolPhraseSID`). The last line goes on to the label's `next`, or ends the dialog.
 */
function labelLines(topic: Topic, label: Label) {
  return label.lines.map((line, i) => {
    const sid = lineSID(topic, label, i);
    const next = i < label.lines.length - 1 ? lineSID(topic, label, i + 1) : nextSID(topic, label);
    const phrase = getDialogPhrase(sid, chainSID(topic), line.by === "wolf" ? 0 : -1, [{ sid: next, terminate: false }], sid);
    return line.money ? Object.assign(phrase, getMoney(line.money)) : phrase;
  });
}

/** Every label's lines, and a reply picker for each choice point. */
function topicPrototypes(topic: Topic) {
  const { labels, pickers } = walk(topic);
  return [
    ...labels.flatMap((label) => labelLines(topic, label)),
    ...pickers.map((picker) =>
      getWaitForReply(
        pickerSID(topic, picker),
        chainSID(topic),
        picker.choices.map((choice) => ({
          sid: lineSID(topic, choice, 0),
          ...(choice.needsItem ? { conditions: hasItem(choice.needsItem) } : {}),
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
  return TOPICS.flatMap(topicPrototypes);
};
transformDialogPrototypes.files = ["/DialogPrototypes/RookieVillage_Hub_volk_1_InfoTopic_1.cfg"];
