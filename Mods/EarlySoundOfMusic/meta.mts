import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { QuestNodePrototype, QuestPrototype } from "s2cfgtojson";
import { getLaunchers } from "../../src/struct-utils.mts";

/**
 * Vanilla gating of The Sound of Music (Sledgehammer, Kindergarten). Arch_SQ_L_Container
 * runs the prologue SQ88_P from Arch_SQ_L_Start for the whole game (it only ends at the
 * E14_MQ02 point of no return). The gate and the cancels sit inside the prologue:
 *
 *  SQ88_P_Container (runs SQ88)
 *    launcher: SQ88_P_Start AND Pin_0 (within 150 m of the shop AND E07_MQ01 Pending)
 *  SQ88_OnJournalQuestEvent_E07_MQ01 (inside SQ88): on E07_MQ01 start, journal Fail and
 *    End_QuestSkipped, so a quest in progress is skipped.
 *  SQ88_P_OnJournalQuestEvent_E07_MQ01*: on the same start, the prologue excludes Sledgehammer's
 *    spawn (he despawns) and the SQ88_C01 container, excludes the zombie restrictor and zombie
 *    spawn, despawns the zombie squads, and runs the post-quest cleanup (fallback bodies near
 *    the school and the garden, kindergarten and school doors unlocked and opened, lairs back on).
 *
 * Node state is saved per SID, so on a save past the E07_MQ01 start those prologue nodes are
 * Excluded or already fired and no data edit can revive them. Hence:
 *
 *  1. SQ88_P is cloned as a new quest, CLONE_QUEST, every node SID renamed. It has no saved
 *     state, so it spawns Sledgehammer, relocks the kindergarten, sets up the zombies and the
 *     restrictor and runs SQ88_C01 again. Its inner container still runs vanilla SQ88, which
 *     restarts from the top if it already ran; SQ88 spawns its own NPCs and bodies.
 *     In the clone: the E07_MQ01 gate is dropped from the container pin, the container runs once,
 *     its E07_MQ01 events never subscribe, and the SQ88_VFX container is left out (the vanilla
 *     prologue's one is still running it).
 *  2. A new Arch_SQ_L container runs the clone once E07_MQ01 has started (the vanilla window is
 *     closed for good then), SQ88 is not Finished, the vanilla container is not running SQ88,
 *     and vanilla SQ88 did not end as completed or failed (only its E07_MQ01 skip reopens it).
 *     It is checked by a Repeatable pin on Arch_SQ_L_Start (new games) and on every world load
 *     (gameStartCommand). It is not Repeatable: one run per save.
 *  3. No vanilla gate or cancel is edited: before E07_MQ01 vanilla runs the quest as before,
 *     and a quest in progress when E07_MQ01 starts is skipped as in vanilla, then offered
 *     again from the start by the clone.
 *  4. The dynamic events that wait for the vanilla prologue's quest end (GDEQ1121, GDEQ1122) also
 *     accept the clone's.
 *
 * Known gaps: the vanilla cleanup on the E07_MQ01 start already unlocked and opened the school
 * door, and no cfg holds a lock signal for it, so it stays open in the restarted quest. The
 * vanilla prologue keeps listening to SQ88's journal and item events, so its post-quest
 * reactions (Greben's body, note and pistol, Sledgehammer's after-quest line) may run next to
 * the clone's.
 */

const CLONE_QUEST = "SQ88_P_EarlySoundOfMusic";
const LEVEL_START = "Arch_SQ_L_Start";
/** Vanilla prologue container that runs SQ88. */
const VANILLA_CONTAINER = "SQ88_P_Container";
const CLONE_CONTAINER = "Arch_SQ_L_Container_SQ88_P_EarlySoundOfMusic";
const CLONE_CONTAINER_PIN = `${CLONE_CONTAINER}_Pin_0`;
const ON_WORLD_LOAD = "EarlySoundOfMusic_OnWorldLoad";
/** Vanilla prologue nodes launched by SQ88's End pins, except End_QuestSkipped. */
const VANILLA_REAL_ENDS = ["SQ88_P_Technical_QuestCompleted", "SQ88_P_Technical_QuestFailed", "SQ88_P_Technical_KuvaldaShootOnStart"];
/** The prologue's reactions to the E07_MQ01 start. */
const E07_EVENTS = [
  "SQ88_P_OnJournalQuestEvent_E07_MQ01",
  "SQ88_P_OnJournalQuestEvent_E07_MQ01_Signal",
  "SQ88_P_OnJournalQuestEvent_E07_MQ01_Zombies",
  "SQ88_P_OnJournalQuestEvent_E07_MQ01_ZombieDespawn",
];
/** The vanilla prologue still runs SQ88_VFX; a second container on the same quest is not cloned. */
const NOT_CLONED = ["SQ88_P_Container_VFX"];

const cloneSID = (sid: string) => sid.replace(/^SQ88_P_/, `${CLONE_QUEST}_`);

/** Repoints every reference to an SQ88_P node or to the quest itself at the clone. */
function renameRefs(s: Struct) {
  s.forEach(([k, v]) => {
    if (v instanceof Struct) {
      renameRefs(v);
    } else if (v === "SQ88_P") {
      (s as any)[k] = CLONE_QUEST;
    } else if (typeof v === "string" && v.startsWith("SQ88_P_")) {
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

function notReached(sid: string) {
  return {
    ConditionType: "EQuestConditionType::Bridge",
    ConditionComparance: "EConditionComparance::NotEqual",
    LinkedNodePrototypeSID: sid,
    CompletedNodeLauncherNames: { 0: "" },
  };
}

/** One condition per group, all required. */
function gate() {
  const conditions = [
    journalCondition("E07_MQ01", "NotEqual", "Pending"),
    journalCondition("SQ88", "NotEqual", "Finished"),
    {
      ConditionType: "EQuestConditionType::NodeState",
      ConditionComparance: "EConditionComparance::NotEqual",
      TargetNode: VANILLA_CONTAINER,
      NodeState: "EQuestNodeState::Activated",
    },
    ...VANILLA_REAL_ENDS.map(notReached),
  ];
  return {
    ...Object.fromEntries(conditions.map((c, i) => [i, { 0: c }])),
    ConditionCheckType: "EConditionCheckType::And",
  };
}

function transformArchSQL(struct: QuestNodePrototype) {
  // Anchor for the new container and its gate; the vanilla container is not returned.
  if (struct.SID !== "Arch_SQ_L_Container") {
    return;
  }
  // New games: Arch_SQ_L_Start runs at the start, and the Repeatable pin waits for the gate.
  const pin = newRootNode(CLONE_CONTAINER_PIN, {
    Repeatable: true,
    QuestSID: "Arch_SQ_L",
    NodeType: "EQuestNodeType::Condition",
    Launchers: getLaunchers([{ SID: LEVEL_START }]),
    Conditions: gate(),
  });
  // Existing saves: Arch_SQ_L_Start finished long ago, so the same gate is checked on every
  // world load (gameStartCommand).
  const onWorldLoad = newRootNode(ON_WORLD_LOAD, {
    Repeatable: true,
    QuestSID: "Arch_SQ_L",
    NodeType: "EQuestNodeType::If",
    Conditions: gate(),
  });
  const container = newRootNode(CLONE_CONTAINER, {
    Repeatable: false,
    QuestSID: "Arch_SQ_L",
    NodeType: "EQuestNodeType::Container",
    OutputPinNames: { 0: cloneSID("SQ88_P_End") },
    Launchers: getLaunchers([
      [{ SID: LEVEL_START, Name: "" }, { SID: CLONE_CONTAINER_PIN }],
      { SID: ON_WORLD_LOAD, Name: "True" },
    ]),
    ContaineredQuestPrototypeSID: CLONE_QUEST,
  });
  return [pin, onWorldLoad, container];
}
transformArchSQL.files = ["/QuestNodePrototypes/Arch_SQ_L.cfg"];

function transformSQ88PNodes(struct: QuestNodePrototype) {
  if (NOT_CLONED.includes(struct.SID)) {
    return;
  }
  const clone = struct.clone();
  const original = struct.SID;
  renameRefs(clone);
  clone.__internal__.rawName = clone.SID;
  clone.__internal__.isRoot = true;
  delete clone.__internal__.refkey;
  delete clone.__internal__.refurl;

  if (original === VANILLA_CONTAINER) {
    // The clone's gate already holds; one run of SQ88 per run of the clone.
    clone.Repeatable = false;
  }
  if (original === "SQ88_P_Container_Pin_0") {
    // Distance to the shop only: group [1] is "E07_MQ01 Equal Pending".
    (clone as any).Conditions = (clone as any).Conditions.filter(([key]) => key !== "1");
  }
  if (E07_EVENTS.includes(original)) {
    // Event nodes with no Launchers: clearing LaunchOnQuestStart means they never subscribe.
    clone.LaunchOnQuestStart = false;
    clone.TrackBeforeActive = false;
  }
  return clone;
}
transformSQ88PNodes.files = ["/QuestNodePrototypes/SQ88_P.cfg"];

function transformSQ88PRegistration(struct: QuestPrototype) {
  if (struct.SID !== "SQ88_P") {
    return;
  }
  return new Struct({
    __internal__: { rawName: CLONE_QUEST, isRoot: true },
    SID: CLONE_QUEST,
    DLC: "BaseGame",
  }) as QuestPrototype;
}
transformSQ88PRegistration.files = ["/QuestPrototypes/SQ88_P.cfg"];

function transformDynamicEvents(struct: QuestNodePrototype) {
  // Either of the prologue's quest-end technicals starts these events; the clone's do too.
  if (struct.SID !== "GDEQ_Global_1121_Pin_0" && struct.SID !== "GDEQ1122_BP_Trigger_Player_ApproachBoiler_Pin_0") {
    return;
  }
  const group = (struct as any).Conditions[0];
  const added = group.fork();
  const count = group.entries().length;
  group.forEach(([key, condition]) => {
    const copy = condition.clone();
    copy.LinkedNodePrototypeSID = cloneSID(copy.LinkedNodePrototypeSID);
    added.addNode(copy, count + Number(key));
  });
  const conditions = (struct as any).Conditions.fork();
  conditions.addNode(added, 0);
  const fork = struct.fork();
  (fork as any).Conditions = conditions;
  return fork;
}
transformDynamicEvents.files = ["/QuestNodePrototypes/GDEQ_Global.cfg", "/QuestNodePrototypes/GDEQ1122_BP.cfg"];

export const meta: MetaType = {
  description: `
Lets you pick up and complete The Sound of Music side quest after the main story has moved on.
[h1][/h1]
Vanilla only offers Sledgehammer's job until "Just Like the Good Old Days" starts, and skips the quest outright at that point, even halfway through.

With this mod, the quest is offered again once that main quest has started: Sledgehammer is back at his shop and the quest plays out from the start, with the zombies, the kindergarten and the rest of the setup restored. Nothing changes before that point.

Works on existing saves, including ones where the quest was skipped. A quest you already completed, or failed by Sledgehammer's death, stays as it is.
[h1][/h1]
In case the quest doesn't start for some reason, run this command:
[h1][/h1]
XStartQuestNodeBySID Arch_SQ_L_Container_SQ88_P_EarlySoundOfMusic
[h1][/h1]
and walk up to Sledgehammer's shop. If he still doesn't call out to you, run:
[h1][/h1]
XStartQuestNodeBySID SQ88_P_EarlySoundOfMusic_Container
[h1][/h1]
`,
  changenote: "Initial release.",
  gameStartCommand: `XStartQuestNodeBySID ${ON_WORLD_LOAD}`,
  structTransformers: [transformArchSQL, transformSQ88PNodes, transformSQ88PRegistration, transformDynamicEvents],
};
