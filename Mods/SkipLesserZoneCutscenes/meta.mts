import { DialogPrototype, QuestNodePrototype, QuestNodePrototypeContainer, Struct } from "s2cfgtojson";
import { MetaContext, MetaType, StructTransformer } from "../../src/meta-type.mts";
import { markAsForkRecursively } from "../../src/mark-as-fork-recursively.mts";

const structTransformer: StructTransformer<QuestNodePrototype> = (struct, context) => {
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

  if (struct.NodeType === "EQuestNodeType::RestrictSave") {
    const fork = struct.fork();
    fork.Launchers = new Struct() as any;
    return fork;
  }

  if (struct.SID === "E02_MQ03_C05_Container_PlayCutscene") {
    return reroute(struct, context, ["E02_MQ03_C05_Technical_PripyLive", "E02_MQ03_C05_Technical_E02_MQ03_PripoyCutscene_Alive"]);
  }

  if (context.filePath.endsWith("E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg") && "Unskippable" in struct) {
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
  changenote: "Fix save restrictors 2",
  structTransformers: [structTransformer],
};

function reroute(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>, dependants: string[]) {
  const fork = struct.fork() as QuestNodePrototypeContainer;
  const structs = [fork];
  fork.Launchers = new Struct() as QuestNodePrototypeContainer["Launchers"];

  dependants.forEach((sid) => {
    const target = context.structsById[sid] as QuestNodePrototypeContainer;
    const finishFork = target.fork();
    finishFork.Launchers = target.Launchers.fork(true).filter(
      ([_, l]) =>
        !!l.Connections.filter(([_2, c]) => {
          return c.SID !== struct.SID; // remove currently removed node from connections
        }).entries().length,
    );
    const currentKeys = new Set(finishFork.Launchers.entries().map(([k]) => k));
    (struct as QuestNodePrototypeContainer).Launchers.forEach(([_, l]) => finishFork.Launchers.addNode(l));
    finishFork.Launchers = finishFork.Launchers.filter(([k]) => !currentKeys.has(k));

    structs.push(markAsForkRecursively(finishFork));
  });

  return structs;
}
