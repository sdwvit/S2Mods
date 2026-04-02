import { Struct } from "s2cfgtojson";
import type { DialogPrototype, QuestNodePrototype, QuestNodePrototypeContainer } from "s2cfgtojson";
import type { MetaContext, MetaType, StructTransformer } from "../../src/meta-type.mts";
// import "../../GameLite/GameData/QuestNodePrototypes/E01_MQ01.cfg.js";
// import "../../GameLite/GameData/QuestNodePrototypes/E02_MQ01.cfg.js";
// import "../../GameLite/GameData/QuestNodePrototypes/E02_MQ03.cfg.js";
// import "../../GameLite/GameData/QuestNodePrototypes/E02_MQ03_C05.cfg.js";
// import "../../GameLite/GameData/DialogPrototypes/E02_MQ03_Dialog_Warlock_in_Bar_after_CS.cfg";

// todo, skips intro, but still forces player into bunker, as the point 1 scan is not ready, and tower is not fallen.
const toReroute = new Set([
  "E01_MQ01_PlayVideo",
  "E01_MQ01_SetItemGenerator_Player_Empty",
  "E01_MQ01_Cutscene_Napadenie",
  "E01_MQ01_Start_PlaceScanner",
  "E01_MQ01_Start_PlaceScanner_1",
  "E01_MQ01_Cutscene_Intro",
  "OnSignalReceived_1",
  "OnPlayerGetItemEvent_CPrologArtifactSlug",
  "OnPlayerGetItemEvent_EchoE01",
  "OnSignalReceived_BunkerPanel",
  "OnSignalReceived_2",
  "E02_MQ01_Container_Awakening_Cutscene",
  "E02_MQ02_SetDialog_Zalesie_Hub_dada_lena_0_BusyTopic",
  "E02_MQ03_Container_Cutscene",
  "E02_MQ03_RestrictSave",

  "OnNPCCreateEvent_Pripoy",
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
    return reroute(struct, context);
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

function getDependants(structSID: string, context: MetaContext<QuestNodePrototype>) {
  return context.array.filter((s) => {
    let hasDependant = false;
    s.Launchers?.forEach?.(([, l]) => {
      l.Connections.forEach(([, c]) => {
        if (c.SID === structSID) {
          hasDependant = true;
        }
      });
    });
    return hasDependant;
  });
}

const nextIndexByDependant = new Map<string, number>();

function reroute(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>) {
  if (!struct.Launchers) {
    return;
  }

  const structFork = struct.fork();
  structFork.Launchers = new Struct() as any;
  const structs = [structFork];

  const traversedReroutes = new Set<string>();
  let dependants = new Set([struct.SID]);

  while (dependants.intersection(toReroute).size) {
    // expand
    for (const dependantSID of dependants) {
      if (toReroute.has(dependantSID)) {
        traversedReroutes.add(dependantSID);
      }
      dependants.delete(dependantSID);
      dependants = dependants.union(
        new Set(getDependants(dependantSID, context).map((s) => s.SID)),
      );
    }
  }

  // for event listeners
  for (const sid of traversedReroutes) {
    const extras = extraDependantsByParentSID[sid];
    if (extras) {
      dependants = dependants.union(new Set(extras));
    }
  }

  for (const dependantSID of dependants) {
    const dependant = context.structsById[dependantSID];
    const dependantFork = dependant.fork();
    dependantFork.Launchers = dependant.Launchers.fork();
    let nextIndex = nextIndexByDependant.get(dependantSID) ?? dependant.Launchers.entries().length;
    struct.Launchers.forEach?.(([, l]) => {
      const launcher = l.fork();
      launcher.Connections ||= l.Connections.filter(([, c]) => !toReroute.has(c.SID));
      if (!launcher.Connections.entries().length) {
        return;
      }
      dependant.Launchers.forEach(([k, l]) =>
        l.Connections.forEach(([k2, c]) => {
          if (c.SID === struct.SID) {
            dependantFork.Launchers[k] ||= new Struct().fork() as any;
            dependantFork.Launchers[k].Connections ||= new Struct().fork() as any;
            dependantFork.Launchers[k].Connections[k2] = new Struct() as any;
          }
        }),
      );
      dependantFork.Launchers.addNode(launcher, nextIndex++);
    });
    nextIndexByDependant.set(dependantSID, nextIndex);
    structs.push(dependantFork);
  }

  return structs;
}
