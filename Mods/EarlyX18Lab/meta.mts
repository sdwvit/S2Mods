import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { DialogPrototype, QuestNodePrototype, QuestPrototype } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

/**
 * Vanilla gating of the X18 Lab side quest. SQ103_P is the prologue (Diode's radio call
 * from seven trigger volumes, the give-quest dialog, key card) and runs SQ103, the lab
 * itself. All gating lives in the Garbage_L level graph, ticked by
 * Garbage_L_OnTickEvent_SQ103Start:
 *
 *  Garbage_L_Container_SQ103 (runs SQ103_P)
 *    launcher[0]:           tick AND Pin_0 (E03_MQ06 Finished AND E08_MQ01 Pending)
 *    launcher[1] excluding: tick AND Pin_2 (E08_MQ01 Active OR SQ103 not Active)
 *    launcher[2] excluding: Garbage_L_SetJournal_SQ103_Stage_GetToLab
 *  Garbage_L_SetJournal_SQ103_Stage_GetToLab: tick AND (E08_MQ01 Active AND SQ103 Active)
 *    → Cancel SQ103 (and, through launcher[2], exclude the container)
 *  SQ103_OnJournalQuestEvent_E08_MQ01_GetToMalahit (inside SQ103): on "Get to Malachite",
 *    cancels SQ103, ends the quest and turns the X18 bunker door and cardlock off.
 *
 * Node state is saved per SID, so on a save already past that window the vanilla container
 * is Excluded (or never ran) and no data edit can revive it. Hence:
 *
 *  1. SQ103_P is cloned as a new quest, CLONE_QUEST, every node SID renamed. It has no saved
 *     state, so it starts cleanly on any save. Its inner container still runs vanilla SQ103,
 *     which restarts from the top if it already ran.
 *  2. A new Garbage_L container runs the clone, launched by the vanilla tick (already live on
 *     existing saves) once the Slag Heap has been entered, SQ103 is not Finished and the
 *     vanilla container is not currently running. It is not Repeatable: one run per save.
 *  3. Every vanilla gate and cancel is made unsatisfiable through condition edits only, so
 *     no Launchers array is touched: the vanilla container never starts again on new saves,
 *     and one that is already running at install is never excluded or cancelled.
 *  4. Diode's give-quest dialog also accepts the clone's "call heard" node.
 *
 * Known gap: on a save where SQ103 was taken and then cancelled by E08_MQ01, vanilla already
 * sent the X18 bunker door and cardlock ReceiverOff signals. No cfg holds their ReceiverOn
 * counterparts, so the restarted quest cannot switch them back on from here.
 */

const CLONE_QUEST = "SQ103_P_EarlyX18Lab";
const VANILLA_TICK = "Garbage_L_OnTickEvent_SQ103Start";
const VANILLA_CONTAINER = "Garbage_L_Container_SQ103";
const CLONE_CONTAINER = "Garbage_L_Container_SQ103_P_EarlyX18Lab";
const CLONE_CONTAINER_PIN = `${CLONE_CONTAINER}_Pin_0`;
const ON_WORLD_LOAD = "EarlyX18Lab_OnWorldLoad";
/** Fires when Skif first enters the Slag Heap; vanilla ReputationRestoreQuest checks it the same way. */
const SLAG_HEAP_ENTERED = "Terricon_Hub_OnTriggerEnterEvent";

const cloneSID = (sid: string) => sid.replace(/^SQ103_P_/, `${CLONE_QUEST}_`);

/** Repoints every reference to an SQ103_P node or to the quest itself at the clone. */
function renameRefs(s: Struct) {
  s.forEach(([k, v]) => {
    if (v instanceof Struct) {
      renameRefs(v);
    } else if (v === "SQ103_P") {
      (s as any)[k] = CLONE_QUEST;
    } else if (typeof v === "string" && v.startsWith("SQ103_P_")) {
      (s as any)[k] = cloneSID(v);
    }
  });
}

function newRootNode(sid: string, fields: Record<string, unknown>) {
  return new Struct({
    __internal__: { rawName: sid, isRoot: true },
    SID: sid,
    NodePrototypeVersion: 1,
    ...fields,
  }) as QuestNodePrototype;
}

function journalCondition(questSID: string, comparance: string, state: string) {
  return {
    ConditionType: "EQuestConditionType::JournalState",
    ConditionComparance: `EConditionComparance::${comparance}`,
    JournalEntity: "EJournalEntity::Quest",
    JournalState: `EJournalState::${state}`,
    JournalQuestSID: questSID,
  };
}

/**
 * Returns a fork whose Conditions replace the vanilla ones wholesale, after `edit` has
 * rewritten a copy of them.
 */
function withConditions(struct: QuestNodePrototype, edit: (conditions: any) => void) {
  const fork = struct.fork();
  const conditions = (struct as any).Conditions.clone();
  edit(conditions);
  conditions.__internal__.bpatch = false;
  (fork as any).Conditions = conditions;
  return fork;
}

function transformGarbageL(struct: QuestNodePrototype) {
  switch (struct.SID) {
    // Pin_0 = E03_MQ06 Finished AND E08_MQ01 Pending. Group [2] becomes
    // "E03_MQ06 NotEqual Finished", which contradicts group [0].
    case "Garbage_L_Container_SQ103_Pin_0":
      return withConditions(struct, (c) => {
        Object.assign(c[2][0], journalCondition("E03_MQ06", "NotEqual", "Finished"));
      });

    // Pin_2 = E08_MQ01 Active OR SQ103 NotEqual Active. Group [0] becomes "SQ103 Equal
    // Active" and the check becomes And, which contradicts group [2].
    case "Garbage_L_Container_SQ103_Pin_2":
      return withConditions(struct, (c) => {
        Object.assign(c[0][0], journalCondition("SQ103", "Equal", "Active"));
        c.ConditionCheckType = "EConditionCheckType::And";
      });

    // E08_MQ01 Active AND SQ103 Active. [0] becomes "SQ103 NotEqual Active", which
    // contradicts [1]: the cancel never fires, so it never excludes the vanilla container.
    case "Garbage_L_SetJournal_SQ103_Stage_GetToLab_Pin_0":
      return withConditions(struct, (c) => {
        Object.assign(c[0][0], journalCondition("SQ103", "NotEqual", "Active"));
      });

    // Anchor for the new container and its gate; the vanilla container is not returned.
    case VANILLA_CONTAINER: {
      const gate = () => ({
          0: {
            0: {
              ConditionType: "EQuestConditionType::Bridge",
              ConditionComparance: "EConditionComparance::Equal",
              LinkedNodePrototypeSID: SLAG_HEAP_ENTERED,
              CompletedNodeLauncherNames: { 0: "" },
            },
          },
          1: { 0: journalCondition("SQ103", "NotEqual", "Finished") },
          2: {
            0: {
              ConditionType: "EQuestConditionType::NodeState",
              ConditionComparance: "EConditionComparance::NotEqual",
              TargetNode: VANILLA_CONTAINER,
              NodeState: "EQuestNodeState::Activated",
            },
          },
          ConditionCheckType: "EConditionCheckType::And",
      });
      const pin = newRootNode(CLONE_CONTAINER_PIN, {
        Repeatable: true,
        QuestSID: "Garbage_L",
        NodeType: "EQuestNodeType::Condition",
        Launchers: getLaunchers([{ SID: VANILLA_TICK }]),
        Conditions: gate(),
      });
      // The same gate, checked on every world load (gameStartCommand), in case the tick never
      // launches the container: players report no radio call on very late saves.
      const onWorldLoad = newRootNode(ON_WORLD_LOAD, {
        Repeatable: true,
        QuestSID: "Garbage_L",
        NodeType: "EQuestNodeType::If",
        Conditions: gate(),
      });

      const container = newRootNode(CLONE_CONTAINER, {
        Repeatable: false,
        QuestSID: "Garbage_L",
        NodeType: "EQuestNodeType::Container",
        OutputPinNames: { 0: cloneSID("SQ103_P_End") },
        // Same shape as the vanilla container's launcher: the tick, ANDed with its pin.
        Launchers: getLaunchers([
          [{ SID: VANILLA_TICK, Name: "" }, { SID: CLONE_CONTAINER_PIN }],
          { SID: ON_WORLD_LOAD, Name: "True" },
        ]),
        ContaineredQuestPrototypeSID: CLONE_QUEST,
      });

      return [pin, onWorldLoad, container];
    }
  }
}
transformGarbageL.files = ["/QuestNodePrototypes/Garbage_L.cfg"];

function transformSQ103PNodes(struct: QuestNodePrototype) {
  const clone = struct.clone();
  renameRefs(clone);
  clone.__internal__.rawName = clone.SID;
  clone.__internal__.isRoot = true;
  delete clone.__internal__.refkey;
  delete clone.__internal__.refurl;
  return clone;
}
transformSQ103PNodes.files = ["/QuestNodePrototypes/SQ103_P.cfg"];

function transformSQ103PRegistration(struct: QuestPrototype) {
  if (struct.SID !== "SQ103_P") {
    return;
  }
  return new Struct({
    __internal__: { rawName: CLONE_QUEST, isRoot: true },
    SID: CLONE_QUEST,
    DLC: "BaseGame",
  }) as QuestPrototype;
}
transformSQ103PRegistration.files = ["/QuestPrototypes/SQ103_P.cfg"];

function transformSQ103(struct: QuestNodePrototype) {
  // Stop the in-quest cancel. This is an event node with no Launchers of its own, so
  // clearing LaunchOnQuestStart is what disables it: it never subscribes, and the cancel /
  // door-shutdown / keycard-cleanup chain hanging off it never runs.
  if (struct.SID === "SQ103_OnJournalQuestEvent_E08_MQ01_GetToMalahit") {
    const fork = struct.fork();
    fork.LaunchOnQuestStart = false;
    fork.TrackBeforeActive = false;
    return fork;
  }
}
transformSQ103.files = ["/QuestNodePrototypes/SQ103.cfg"];

function transformGiveQuestDialog(struct: DialogPrototype) {
  // Diode only pitches the lab if his radio call was heard; accept the clone's call too.
  if (struct.SID !== "SQ103_QD_Skif_Diod_GiveQuest_If") {
    return;
  }
  const fork = struct.fork();
  const options = (struct as any).NextDialogOptions.clone();
  const group = options.True.Conditions[0];
  const heard = group[0].clone();
  heard.LinkedNodePrototypeSID = cloneSID(heard.LinkedNodePrototypeSID);
  group.addNode(heard, 1);
  options.True.Conditions.ConditionCheckType = "EConditionCheckType::Or";
  options.__internal__.bpatch = false;
  (fork as any).NextDialogOptions = options;
  return fork;
}
transformGiveQuestDialog.files = ["/DialogPrototypes/SQ103_QD_Skif_Diod_GiveQuest.cfg"];

export const meta: MetaType = {
  description: `
Lets you pick up and complete the X18 Lab side quest at any point of the main story.

Vanilla only offers it in a narrow window of the main story, and cancels it outright once the story moves on.

With this mod, Diode's radio call comes as soon as you have been to the Slag Heap and walk into one of the usual trigger areas, no matter how far into the main story you are. The quest is never cancelled by main-story progress.

Works on existing saves, including ones where the quest window has already closed.
[h1][/h1]
In case the quest doesn't start for some reason, run these two commands:
[h1][/h1]
XStartQuestNodeBySID Garbage_L_Container_SQ103_P_EarlyX18Lab
[h1][/h1]
XStartQuestNodeBySID SQ103_P_EarlyX18Lab_SetDialog_SQ103_QC_DiodFirstCall
[h1][/h1]
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "The quest's start is now also checked every time a save loads, for very late saves where it never triggered.",
  gameStartCommand: "XStartQuestNodeBySID EarlyX18Lab_OnWorldLoad",
  structTransformers: [
    transformGarbageL,
    transformSQ103PNodes,
    transformSQ103PRegistration,
    transformSQ103,
    transformGiveQuestDialog,
  ],
};
