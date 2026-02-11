import { DialogPrototype, QuestNodePrototype, QuestNodePrototypeContainer, Struct } from "s2cfgtojson";
import { MetaContext, MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
This mod skips / speeds up Intro / Scanner / Wake up with Richter / Zalissya bar / Sphere cutscenes.
[hr][/hr]
Use this mod for frequent resets.[h1][/h1]
`,
  changenote: "Fix save restrictors",
  structTransformers: [structTransformer],
};

const reroute = (struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>, dependants: string[]) => {
  const fork = struct.fork() as QuestNodePrototypeContainer;
  const structs = [fork];
  fork.Launchers = new Struct() as QuestNodePrototypeContainer["Launchers"];

  dependants.forEach((sid) => {
    const finishFork = context.structsById[sid].fork() as QuestNodePrototypeContainer;
    finishFork.Launchers = (struct as QuestNodePrototypeContainer).Launchers;
    structs.push(finishFork);
  });

  return structs;
};

function structTransformer(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  if (struct.SID === "E01_MQ01_PlayVideo") {
    return reroute(struct, context, [
      "E01_MQ01_ItemAdd_Scanner",
      "E01_MQ01_Technical_TestWithoutTeleportTransition",
      "E01_MQ01_ShowMarker_sid_locations_loc_01_scientists_bunker_name_Discovered",
    ]);
  }

  if (struct.SID === "E01_MQ01_Cutscene_Napadenie") {
    return reroute(struct, context, ["E01_MQ01_Finish"]);
  }

  if (struct.SID === "E02_MQ01_Container_Awakening_Cutscene") {
    return reroute(struct, context, [
      "E02_MQ01_Technical_EndPreparation",
      "E02_MQ01_SaveGame_2",
      "E02_MQ01_SendSignal_BP_Dogblooddecal.Receiver_Set_Object_2",
      "E02_MQ01_SendSignal_BP_Dogbloodbody.Receiver_Set_Object_2",
    ]);
  }

  if (struct.SID === "E02_MQ03_Container_Cutscene") {
    return reroute(struct, context, ["E02_MQ03_Technical_BarScene", "E02_MQ03_Technical_E02_MQ01_Bar_Flashback"]);
  }

  if (struct.SID === "E02_MQ03_C05_Container_PlayCutscene") {
    return reroute(struct, context, ["E02_MQ03_C05_Technical_PripyLive", "E02_MQ03_C05_Technical_E02_MQ03_PripoyCutscene_Alive"]);
  }

  if (context.filePath.endsWith('E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg') && 'Unskippable' in struct) {
    const fork = struct.fork() as any as DialogPrototype;
    fork.Unskippable = false;
    return fork;
  }
}

structTransformer.files = [
  "/QuestNodePrototypes/E01_MQ01.cfg",
  "/QuestNodePrototypes/E02_MQ01.cfg",
  "/QuestNodePrototypes/E02_MQ03.cfg",
  "/QuestNodePrototypes/E02_MQ03_C05.cfg",
  "/DialogPrototypes/E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg",
];
