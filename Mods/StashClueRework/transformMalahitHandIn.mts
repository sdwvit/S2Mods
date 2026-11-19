import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

/**
 * Viktoria's mutant-loot hand-in at Malachite (BodyParts_Malahit).
 *
 * Since the 2026-09-11 game update a node a mod adds is never launched by a SetDialog phrase
 * output (`Name = <phrase SID>`); plain launchers (`Name =` empty) still work. Nothing vanilla in
 * this quest runs only on a hand-in (SetGlobalVariable_MutantLootQuest* also run on a refusal), so
 * the "Done" phrases raise a flag through a dialog action, and a Condition node after
 * SetGlobalVariable_MutantLootQuest* checks it. Same wiring as MutantLootReputation, with its own
 * flag and DialogActions slot [1] (MutantLootReputation uses [0]); named keys are ignored there.
 */
const Q = "BodyParts_Malahit";
const FLAG = "StashClueReworkMalahitDone";

export const MALAHIT_DONE_PHRASES = [
  "EQ197_QD_Orders_Done_73061",
  "EQ197_QD_Orders_Done2_73167",
  "EQ197_QD_Orders_Done3_73169",
  "EQ197_QD_Orders_Done_73061_1",
  "EQ197_QD_Orders_Done2_73167_1",
  "EQ197_QD_Orders_Done3_73169_1",
  "EQ197_QD_Orders_Done_73061_2",
  "EQ197_QD_Orders_Done2_73167_2",
  "EQ197_QD_Orders_Done3_73169_2",
  "EQ197_QD_Orders_Done_73061_3",
  "EQ197_QD_Orders_Done2_73167_3",
  "EQ197_QD_Orders_Done3_73169_3",
  "EQ197_QD_Orders_Done_73061_4",
  "EQ197_QD_Orders_Done2_73167_4",
];

/**
 * The player's hand-in replies: they carry vanilla GiveItem (parts) and GetMoney (coupons), and the
 * dialog closes right after them, so Viktoria's closing "Done" line never runs its actions.
 */
const MALAHIT_REPLY_LINES = [
  "EQ197_QD_Orders_Done_73060",
  "EQ197_QD_Orders_Done2_73166",
  "EQ197_QD_Orders_Done3_73168",
  "EQ197_QD_Orders_Done_73060_1",
  "EQ197_QD_Orders_Done2_73166_1",
  "EQ197_QD_Orders_Done3_73168_1",
  "EQ197_QD_Orders_Done_73060_2",
  "EQ197_QD_Orders_Done2_73166_2",
  "EQ197_QD_Orders_Done3_73168_2",
  "EQ197_QD_Orders_Done_73060_3",
  "EQ197_QD_Orders_Done2_73166_3",
  "EQ197_QD_Orders_Done3_73168_3",
  "EQ197_QD_Orders_Done_73060_4",
  "EQ197_QD_Orders_Done2_73166_4",
];

function root<T>(sid: string, fields: Record<string, unknown>) {
  const node = new Struct({ SID: sid, ...fields }) as T & Struct;
  node.__internal__.isRoot = true;
  node.__internal__.rawName = sid;
  return node;
}

let flagAdded = false;
export function transformGlobalVariablePrototypes(struct: Struct) {
  if (flagAdded || struct.__internal__.rawName !== "[0]") return;
  flagAdded = true;
  return root<Struct>(FLAG, { Type: "EGlobalVariableType::Int", DefaultValue: 0 });
}
transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];

export function transformMalahitDialog(struct: Struct & { SID?: string }) {
  if (!MALAHIT_REPLY_LINES.includes(struct.SID)) return;
  const fork = struct.fork();
  const action = () =>
    new Struct({
      DialogAction: "EDialogAction::SetGlobalVariable",
      GlobalVariablePrototypeSID: FLAG,
      ChangeValueMode: "EChangeValueMode::Set",
      VariableValue: 1,
    });
  // Slot [3] next to vanilla GiveItem [0] / GetMoney [1], in both lists (MutantLootReputation uses [2]). The lists are
  // forked (bpatch) so the vanilla entries stay: a plain new Struct replaced them and the hand-in stopped
  // taking the parts and paying (2026-11-19).
  for (const key of ["DialogActions", "DialogAnswerActions"] as const) {
    const list = (struct as any)[key];
    if (!list?.fork) continue;
    const patched = list.fork();
    patched.__internal__.isArray = true;
    patched.__internal__.useAsterisk = false;
    patched.addNode(action(), 3);
    (fork as any)[key] = patched;
  }
  return fork;
}
transformMalahitDialog.files = ["/DialogPrototypes/EQ197_QD_Orders.cfg"];

/** Condition -> console hook that starts the clue roll -> clear the flag. */
export function getMalahitHandInNodes(questStartSID: string) {
  const ifDone = root<QuestNodePrototype>(`${Q}_StashClueRework_IfDone`, {
    QuestSID: Q,
    NodeType: "EQuestNodeType::Condition",
    Repeatable: true,
    Conditions: new Struct({
      0: new Struct({
        0: new Struct({
          ConditionType: "EQuestConditionType::GlobalVariable",
          ConditionComparance: "EConditionComparance::Equal",
          GlobalVariablePrototypeSID: FLAG,
          ChangeValueMode: "EChangeValueMode::Set",
          VariableValue: 1,
        }),
      }),
      ConditionCheckType: "EConditionCheckType::And",
    }),
  });

  // Poll loop (2026-11-19): vanilla nodes never launch a mod node in this quest, but mod -> mod launches
  // and launches by SID work. TickA/TickB re-check the flag every 3 s; meta.gameStartCommand (or the
  // quest start) kicks TickA by SID on each world load, after a delay (chains started at load get dropped).
  const tickA = root<QuestNodePrototype>(`${Q}_StashClueRework_TickA`, {
    QuestSID: Q,
    NodeType: "EQuestNodeType::Technical",
    Repeatable: true,
    StartDelay: 3,
  });
  const tickB = root<QuestNodePrototype>(`${Q}_StashClueRework_TickB`, {
    QuestSID: Q,
    NodeType: "EQuestNodeType::Technical",
    Repeatable: true,
    StartDelay: 3,
  });
  // Started by the mod quest's _Start node (via meta.gameStartCommand -> XStartQuestBySID) on every world load.
  const kick = root<QuestNodePrototype>(`${Q}_StashClueRework_Kick`, {
    QuestSID: Q,
    NodeType: "EQuestNodeType::Technical",
    Repeatable: true,
    StartDelay: 5, // chains started right at world load get dropped
  });
  tickA.Launchers = getLaunchers([{ SID: tickB.SID }, { SID: kick.SID }]);
  tickB.Launchers = getLaunchers([{ SID: tickA.SID }]);
  ifDone.Launchers = getLaunchers([{ SID: tickA.SID }]);
  const hook = root<QuestNodePrototype>(`${Q}_StashClueRework_Hook`, {
    QuestSID: Q,
    NodeType: "EQuestNodeType::ConsoleCommand",
    Repeatable: true,
    ConsoleCommand: `XStartQuestNodeBySID ${questStartSID}`,
  });
  hook.Launchers = getLaunchers([{ SID: ifDone.SID }]);
  const clear = root<QuestNodePrototype>(`${Q}_StashClueRework_ClearFlag`, {
    QuestSID: Q,
    NodeType: "EQuestNodeType::SetGlobalVariable",
    Repeatable: true,
    GlobalVariablePrototypeSID: FLAG,
    ChangeValueMode: "EChangeValueMode::Set",
    VariableValue: 0,
  });
  clear.Launchers = getLaunchers([{ SID: hook.SID }]);
  return [kick, tickA, tickB, ifDone, hook, clear];
}
