import { DialogPrototype, QuestNodePrototype, QuestNodePrototypeContainer, Struct } from "s2cfgtojson";
import { MetaContext, MetaType, StructTransformer } from "../../src/meta-type.mts";

const structTransformer: StructTransformer<QuestNodePrototype> = (struct, context) => {
  if (struct.SID === "E01_MQ01_PlayVideo") {
    return reroute(struct, context, [
      "E01_MQ01_ItemAdd_Scanner",
      "E01_MQ01_Technical_TestWithoutTeleportTransition",
      "E01_MQ01_Start_Point3",
      "E01_MQ01_SendSignal_ThirdPoint_On",
      "E01_MQ01_Technical_3",
      "E01_MQ01_SpawnObjectNPCMonster_BP_NPC_TEST_Zombie1",
      "E01_MQ01_Technical_ZombieAttackOnPlayer",
    ]);
  }

  if (struct.SID === "E01_MQ01_Bunker_Start" || struct.SID === "E01_MQ01_Start_PlaceScanner" || struct.SID === "E01_MQ01_Start_PlaceScanner_1") {
    const fork = struct.fork() as QuestNodePrototypeContainer;
    fork.Launchers = new Struct() as QuestNodePrototypeContainer["Launchers"];
    return fork;
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
  changenote: "Skip bunker/artifact/point1; point3 + wall-destroy + bandit fight available from start",
  structTransformers: [structTransformer],
};

function reroute(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>, dependants: string[]) {
  const fork = struct.fork() as QuestNodePrototypeContainer;
  const structs = [fork];
  fork.Launchers = new Struct() as QuestNodePrototypeContainer["Launchers"];
  const sourceLaunchers = (struct as QuestNodePrototypeContainer).Launchers;

  dependants.forEach((sid) => {
    const target = context.structsById[sid] as QuestNodePrototypeContainer | undefined;
    if (!target) return;

    const finishFork = target.fork();
    const targetLaunchers = target.Launchers;
    if (!targetLaunchers || !sourceLaunchers) {
      structs.push(finishFork.fork(true));
      return;
    }

    finishFork.Launchers = targetLaunchers.fork(true).filter(
      ([_, l]) =>
        !!l.Connections.filter(([_2, c]) => {
          return c.SID !== struct.SID; // remove currently removed node from connections
        }).entries().length,
    );
    const currentKeys = new Set(finishFork.Launchers.entries().map(([k]) => k));
    sourceLaunchers.forEach(([_, l]) => finishFork.Launchers.addNode(l));
    finishFork.Launchers = finishFork.Launchers.filter(([k]) => !currentKeys.has(k));

    structs.push(finishFork.fork(true));
  });

  return structs;
}
