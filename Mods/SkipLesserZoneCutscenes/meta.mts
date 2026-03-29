import { Struct } from "s2cfgtojson";
import type { DialogPrototype, QuestNodePrototype, QuestNodePrototypeContainer } from "s2cfgtojson";
import type { MetaContext, MetaType, StructTransformer } from "../../src/meta-type.mts";


/**
 * todo this skips intro, but doesn't allow to progress past bunker
 */
const toReroute = new Set([
  "E01_MQ01_Cutscene_Intro",
  "E01_MQ01_Bunker_Start",
  "E02_MQ03_C05_Container_PlayCutscene",
  "E01_MQ01_PlayVideo",
  "E01_MQ01_Cutscene_Napadenie",
  "E02_MQ01_Container_Awakening_Cutscene",
  "E02_MQ03_Container_Cutscene",
  "E02_MQ03_RestrictSave",
  "E02_MQ03_C05_RestrictSave",
  "E02_MQ03_C05_Technical_2_PripoyKill",
  "E02_MQ03_C05_Technical_E02_MQ03_PripoyCutscene_Dead",

  "E02_MQ03_C05_ItemAdd_PripoyPDA",
  "E02_MQ03_C05_Despawn_Pripoy",
  "E02_MQ03_C05_Spawn_DeadBody_PripoyDead",
  "E02_MQ03_C05_DisableNPCInteraction_PripoyDead",
]);

const structTransformer: StructTransformer<QuestNodePrototype> = (struct, context) => {
  if (toReroute.has(struct.SID)) {
    return reroute(struct, context);
  }

  if (
    context.filePath.endsWith("E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg") &&
    "Unskippable" in struct
  ) {
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
    "Skip bunker/artifact/point1; point3 + wall-destroy + bandit fight available from start",
  structTransformers: [structTransformer],
};

function reroute(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  const fork = struct.fork() as QuestNodePrototypeContainer;
  const structs = [fork];
  fork.Launchers = new Struct() as QuestNodePrototypeContainer["Launchers"];
  const sourceLaunchers = (struct as QuestNodePrototypeContainer).Launchers;
  const dependants = context.array
    .filter((s) => {
      let hasDependant = false;
      s.Launchers?.forEach?.(([, l]) => {
        l.Connections.forEach(([, c]) => {
          if (c.SID === struct.SID) {
            hasDependant = true;
          }
        });
      });
      return hasDependant;
    })
    .map((s) => s.SID);
  dependants.forEach((sid) => {
    const target = context.structsById[sid] as QuestNodePrototypeContainer | undefined;
    if (!target || toReroute.has(sid)) return;

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
