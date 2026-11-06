import type { QuestNodePrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { factionTitle, QUEST_SID, root, TEST_LAIRS, type TestLair } from "./lairMarker.mts";

type Launcher = { SID: string; Name?: string };

/**
 * Never Repeatable: a Repeatable node fires again on every quest update while its launcher counts as done
 * (LairTiers, 2026-10-29). So each check runs once per run of the quest; `XResetQuestBySID LairMarkerTest`
 * runs them all again.
 */
const node = (sid: string, quest: string, fields: Record<string, unknown>, launchers?: Launcher[]) => {
  const s = root<QuestNodePrototype>(sid, { QuestSID: quest, Repeatable: false, ...fields });
  if (launchers?.length) s.Launchers = getLaunchers(launchers);
  return s;
};

const ifNode = (sid: string, quest: string, condition: Record<string, unknown>, launchers: Launcher[]) =>
  node(sid, quest, { NodeType: "EQuestNodeType::If", Conditions: { 0: { 0: condition } } }, launchers);

const onStart = (sid: string, quest: string) =>
  node(sid, quest, {
    NodeType: "EQuestNodeType::OnTickEvent",
    LaunchOnQuestStart: true,
    EventType: "EQuestEventType::OnTick",
    TrackBeforeActive: false,
  });

/** Seconds between two lairs' checks in a label quest, so they don't all run at once. */
const SECONDS_PER_LAIR = 0.5;

/**
 * One lair's check, inside a label quest: the instance LairTiers has switched on (every instance, for a lair
 * without copies) is asked IsLairOwnedByFaction for each possible inhabitant, and the owner's name becomes the
 * marker's title.
 */
function getCheckNodes(lair: TestLair, quest: string, launchers: Launcher[]) {
  const prefix = `${quest}_${lair.guid}`;
  const nodes: QuestNodePrototype[] = [];
  for (const { tier, guid } of lair.instances) {
    let ask: Launcher[] = launchers;
    if (lair.tierVariable) {
      const active = ifNode(
        `${prefix}_Active_T${tier}`,
        quest,
        {
          ConditionType: "EQuestConditionType::GlobalVariable",
          ConditionComparance: "EConditionComparance::Equal",
          GlobalVariablePrototypeSID: lair.tierVariable,
          ChangeValueMode: "EChangeValueMode::Set",
          VariableValue: tier,
        },
        ask,
      );
      nodes.push(active);
      ask = [{ SID: active.SID, Name: "True" }];
    }
    for (const faction of lair.factions) {
      const owned = ifNode(
        `${prefix}_T${tier}_${faction}`,
        quest,
        {
          ConditionType: "EQuestConditionType::IsLairOwnedByFaction",
          ConditionComparance: "EConditionComparance::Equal",
          TargetLairPlaceholder: guid,
          Faction: faction,
        },
        ask,
      );
      const title = factionTitle(faction);
      nodes.push(
        owned,
        node(
          `${prefix}_T${tier}_${faction}_Title`,
          quest,
          { NodeType: "EQuestNodeType::SetLocationName", Location: lair.markerSID, NewTitle: title, NewDescription: title },
          [{ SID: owned.SID, Name: "True" }],
        ),
      );
    }
  }
  return nodes;
}

/** Lairs per label quest; each is a quest of its own that runs once and ends, so no big quest stays running. */
const LAIRS_PER_LABEL_QUEST = 10;
/** The label chain starts over this long after its last quest. */
const RELABEL_SECONDS = 300;
const labelQuestSID = (batch: number) => `${QUEST_SID}_Label_${batch}`;
const labelBatches = Array.from({ length: Math.ceil(TEST_LAIRS.length / LAIRS_PER_LABEL_QUEST) }, (_, b) =>
  TEST_LAIRS.slice(b * LAIRS_PER_LABEL_QUEST, (b + 1) * LAIRS_PER_LABEL_QUEST),
);

/** Restarts a quest (or starts one that never ran); fires once per run of its quest. */
const restartQuest = (sid: string, quest: string, target: string, launchers: Launcher[]) =>
  node(sid, quest, { NodeType: "EQuestNodeType::ConsoleCommand", ConsoleCommand: `XResetQuestBySID ${target}` }, launchers);

/**
 * The always-on test quest, one Spawn node per lair: it spawns every lair's marker (no ShowMarker: the Spawn node's
 * marker is the one its Despawn can remove) and starts the label chain.
 */
function getMainQuestNodes() {
  const start = onStart(`${QUEST_SID}_Start`, QUEST_SID);
  const spawns = TEST_LAIRS.map((lair) =>
    node(
      `${QUEST_SID}_${lair.guid}_Spawn`,
      QUEST_SID,
      { NodeType: "EQuestNodeType::Spawn", TargetQuestGuid: lair.markerActorGUID, SpawnHidden: false, SpawnNodeExcludeType: "ESpawnNodeExcludeType::ForceDespawn" },
      [{ SID: start.SID }],
    ),
  );
  return [start, ...spawns, restartQuest(`${QUEST_SID}_Label`, QUEST_SID, labelQuestSID(0), [{ SID: start.SID }])];
}

/**
 * Label_<b>: checks its lairs SECONDS_PER_LAIR apart, then starts the next batch and ends. The last batch waits
 * RELABEL_SECONDS and starts Label_0 again. `XResetQuestBySID LairMarkerTest_Label_0` relabels now.
 */
function getLabelQuestNodes(b: number) {
  const quest = labelQuestSID(b);
  const start = onStart(`${quest}_Start`, quest);
  const nodes: QuestNodePrototype[] = [start];
  const batch = labelBatches[b];
  batch.forEach((lair, i) => {
    const delay = node(`${quest}_${lair.guid}_Delay`, quest, { NodeType: "EQuestNodeType::Technical", StartDelay: i * SECONDS_PER_LAIR }, [
      { SID: start.SID },
    ]);
    nodes.push(delay, ...getCheckNodes(lair, quest, [{ SID: delay.SID }]));
  });
  const last = b + 1 === labelBatches.length;
  const wait = node(
    `${quest}_Wait`,
    quest,
    { NodeType: "EQuestNodeType::Technical", StartDelay: batch.length * SECONDS_PER_LAIR + (last ? RELABEL_SECONDS : 0) },
    [{ SID: start.SID }],
  );
  const next = restartQuest(`${quest}_Next`, quest, labelQuestSID(last ? 0 : b + 1), [{ SID: wait.SID }]);
  nodes.push(wait, next, node(`${quest}_End`, quest, { NodeType: "EQuestNodeType::End", ExcludeAllNodesInContainer: false }, [{ SID: next.SID }]));
  return nodes;
}

/** Every quest this mod adds, for QuestPrototypes. */
export const TEST_QUEST_SIDS = [QUEST_SID, ...labelBatches.map((_, b) => labelQuestSID(b))];

let once = false;

/** rootgraph_Start starts the test quest on a new game; on an existing save, run `XStartQuestBySID LairMarkerTest`. */
export const transformQuestNodePrototypes: StructTransformer<QuestNodePrototype> = () => {
  if (once) return null;
  once = true;
  const run = root<QuestNodePrototype>(`rootgraph_run_${QUEST_SID}`, {
    QuestSID: "rootgraph",
    NodeType: "EQuestNodeType::ConsoleCommand",
    ConsoleCommand: `XStartQuestBySID ${QUEST_SID}`,
    Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
  });
  return [run, ...getMainQuestNodes(), ...labelBatches.flatMap((_, b) => getLabelQuestNodes(b))];
};

transformQuestNodePrototypes.files = ["/QuestNodePrototypes/rootgraph.cfg"];
