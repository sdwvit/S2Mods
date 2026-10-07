import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { GUID, WAR_PRESET } from "./factionWarActors.mts";

const QUEST_SID = "LairWarTest_Main";
const RUN_SID = `rootgraph_run_${QUEST_SID}`;
const TICK_SID = `${QUEST_SID}_OnTick_Boot`;
const PRESET_SID = `${QUEST_SID}_Preset_War`;

function root(sid: string, fields: Record<string, unknown>): Struct {
  const s = Struct.fromJson({ SID: sid, ...fields }) as unknown as Struct;
  s.__internal__.rawName = sid;
  s.__internal__.isRoot = true;
  return s;
}

/**
 * A FactionWar controller is inert until an FWChangePreset node selects a preset, and our nodes
 * only arm once their quest is running.
 *
 * Starting that quest is done with a ConsoleCommand node hung off `rootgraph_Start` — the
 * pattern DecoupledRanks uses. A Container node (what the DLC and ZoneWar use) does not work
 * from a cfg patch: its output pins are resolved when the graph is compiled in the editor, and
 * the runtime loader never instantiates the containered quest. `XStartQuestBySID` sidesteps the
 * graph entirely.
 */
export const transformRootgraph: StructTransformer<Struct> = (struct) => {
  if (String(struct.SID) !== "rootgraph_Start") return null;

  const run = root(RUN_SID, {
    QuestSID: "rootgraph",
    NodeType: "EQuestNodeType::ConsoleCommand",
    ConsoleCommand: `XStartQuestBySID ${QUEST_SID}`,
    Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
  });

  // Repeatable, so the graph keeps ticking instead of consuming itself on frame one. The tick
  // also buys the spawn actors a frame to exist before FWChangePreset looks one up.
  const tick = root(TICK_SID, {
    QuestSID: QUEST_SID,
    NodeType: "EQuestNodeType::OnTickEvent",
    Repeatable: true,
    LaunchOnQuestStart: true,
    EventType: "EQuestEventType::OnTick",
    TrackBeforeActive: false,
  });

  const changePreset = root(PRESET_SID, {
    QuestSID: QUEST_SID,
    NodeType: "EQuestNodeType::FWChangePreset",
    Launchers: getLaunchers([{ SID: TICK_SID }]),
    PresetName: WAR_PRESET,
    FactionWarPlaceholder: GUID.controller,
  });

  return [run, tick, changePreset];
};

transformRootgraph.files = ["/QuestNodePrototypes/rootgraph.cfg"];

/**
 * A quest whose SID is not registered in QuestPrototypes can never be started, so none of its
 * LaunchOnQuestStart nodes ever arm. SID + DLC is all the registration needs.
 */
export const transformQuestPrototypes: StructTransformer<Struct> = (struct) => {
  if (String(struct.SID) !== "rootgraph") return null;
  return root(QUEST_SID, { DLC: "None" });
};

transformQuestPrototypes.files = ["/QuestPrototypes/rootgraph.cfg"];
