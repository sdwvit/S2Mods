import type { DialogPrototype, QuestNodePrototype } from "s2cfgtojson";
import type { MetaType, StructTransformer } from "../../src/meta-type.mts";
import { rerouteQuestNode } from "../../src/struct-utils.mts";

// todo, skips intro, but still forces player into bunker, as the point 1 scan is not ready, and tower is not fallen.
const toReroute = new Set([
  "E01_MQ01_PlayVideo",
  "E01_MQ01_Cutscene_Intro",

  "E01_MQ01_SetItemGenerator_Player_Empty",

  "E01_MQ01_Cutscene_Napadenie",
  "E01_MQ01_Start_PlaceScanner", // 1st point
  "E01_MQ01_Start_PlaceScanner_1", // 2nd point
  "E01_MQ01_OnSignalReceived_1",
  "E01_MQ01_OnPlayerGetItemEvent_CPrologArtifactSlug",
  "E01_MQ01_OnPlayerGetItemEvent_EchoE01",
  "E01_MQ01_OnSignalReceived_BunkerPanel",
  "E01_MQ01_OnSignalReceived_2",
  "E02_MQ01_Container_Awakening_Cutscene",
  "E02_MQ02_SetDialog_Zalesie_Hub_dada_lena_0_BusyTopic",
  "E02_MQ03_Container_Cutscene",
  "E02_MQ03_RestrictSave",

  "E02_MQ03_C05_OnNPCCreateEvent_Pripoy",
  "E02_MQ03_C05_ItemAdd_PripoyPDA",
  "E02_MQ03_C05_Technical_2_PripoyKill",
  "E02_MQ03_C05_Container_PlayCutscene",
  "E02_MQ03_C05_Despawn_Pripoy",
  "E02_MQ03_C05_Technical_E02_MQ03_PripoyCutscene_Dead",
  "E02_MQ03_C05_Spawn_DeadBody_PripoyDead",
  "E02_MQ03_C05_DisableNPCInteraction_PripoyDead",
  "E02_MQ03_C05_RestrictSave",
]);

export const extraDependantsByParentSID: Record<string, string[]> = {};

const structTransformer: StructTransformer<QuestNodePrototype> = (struct, context) => {
  if (toReroute.has(struct.SID)) {
    return rerouteQuestNode(struct, context, toReroute, extraDependantsByParentSID);
  }

  if (context.filePath.endsWith("E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg") && false) {
    const fork = struct.fork() as any as DialogPrototype;
    fork.Unskippable = false;
    return fork;
  }
};

structTransformer.files = [
  "/QuestNodePrototypes/E01_MQ01.cfg",
  "/QuestNodePrototypes/E02_MQ01.cfg",
  "/QuestNodePrototypes/E02_MQ03.cfg",
  "/QuestNodePrototypes/E02_MQ03_C05.cfg",
  "/DialogPrototypes/E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg",
];

export const meta: MetaType = {
  description: `
This mod skips / speeds up Intro / Scanner / Wake up with Richter / Zalissya bar / Sphere cutscenes.
[hr][/hr]
Use this mod for frequent resets.[h1][/h1]
`,
  changenote:
    "Fix duplicate launcher index conflict for shared dependants; support extraDependantsByParentSID for event listeners",
  structTransformers: [structTransformer],
};
