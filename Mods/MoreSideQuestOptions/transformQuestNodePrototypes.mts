import {
  type QuestNodePrototype,
  type QuestNodePrototypeIf,
  type QuestNodePrototypeRandom,
  type QuestNodePrototypeTechnical,
  Struct,
} from "s2cfgtojson";
import type { MetaContext } from "../../src/meta-type.mts";
import { RSQLessThan3QuestNodesSIDs, RSQRandomizerQuestNodesSIDByQuestSID, RSQSetDialogQuestNodesSIDs } from "../../src/consts.mts";
import { deepMerge } from "../../src/deep-merge.mts";
export function transformQuestNodePrototypes(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototypeRandom>) {
  if (RSQLessThan3QuestNodesSIDs.has(struct.SID)) {
    const randomizerNode = context.structsById[RSQRandomizerQuestNodesSIDByQuestSID[struct.QuestSID]];
    if (!randomizerNode) {
      throw new Error(`please fix RSQRandomizerQuestNodesSIDByQuestSID for ${struct.QuestSID}`);
    }
    const total = randomizerNode.OutputPinNames.entries().length;
    return deepMerge(struct.fork(), {
      Conditions: new Struct({
        // as of 1.7 all of them are [0][0]
        0: new Struct({
          0: new Struct({ VariableValue: total }),
        }),
      }),
    }).fork(true);
  }
  if (RSQSetDialogQuestNodesSIDs.has(struct.SID)) {
    let connectionIndex: string;
    const [launcherIndex] = (struct as QuestNodePrototypeIf).Launchers.entries().find((e) => {
      return e[1].Connections.entries().find((e1) => {
        connectionIndex = e1[0];
        return RSQLessThan3QuestNodesSIDs.has(e1[1].SID);
      });
    });
    return deepMerge(struct.fork(), {
      Launchers: new Struct({
        [launcherIndex]: new Struct({
          Connections: new Struct({
            [connectionIndex]: new Struct({
              Name: "True",
            }),
          }),
        }),
      }),
    }).fork(true);
  }
  // Replace Random nodes with Technical pass-through so all quest options appear simultaneously
  if (RSQRandomizerQuestNodesSIDByQuestSID[struct.QuestSID] === struct.SID) {
    const dependants = context.array
      .filter(
        (s) =>
          s.Launchers instanceof Struct &&
          s.Launchers.entries().some(([, l]) => l.Connections instanceof Struct && l.Connections.entries().some(([, c]) => c.SID === struct.SID)),
      )
      .map((s) => s.SID);
    return rerouteRandomToTechnical(struct as QuestNodePrototype, context as MetaContext<QuestNodePrototype>, dependants);
  }
}

function rerouteRandomToTechnical(struct: QuestNodePrototype, context: MetaContext<QuestNodePrototype>, dependants: string[]) {
  // Strip Random node's launchers (deactivate it)
  const randomFork = struct.fork() as QuestNodePrototypeRandom;
  randomFork.Launchers = new Struct() as any;

  const techSID = struct.SID.replace("_Random", "_Technical");
  // Create new Technical node inheriting Random's launchers
  const techNode = new Struct() as QuestNodePrototypeTechnical;
  techNode.__internal__.isRoot = true;
  techNode.SID = techSID;
  techNode.__internal__.rawName = techNode.SID;
  techNode.QuestSID = (struct as QuestNodePrototypeRandom).QuestSID;
  techNode.NodeType = "EQuestNodeType::Technical";
  techNode.StartDelay = 0;
  techNode.LaunchOnQuestStart = false;
  techNode.Launchers = (struct as QuestNodePrototypeRandom).Launchers.clone();

  const extraStructs: Struct[] = [randomFork, techNode];

  // Reroute dependants: patch connection from Random → Technical, clear Name
  for (const sid of dependants) {
    const target = context.structsById[sid] as QuestNodePrototypeRandom;
    if (!target?.Launchers) continue;

    const launcherPatches: Record<string, any> = {};
    target.Launchers.entries().forEach(([lIdx, launcher]) => {
      if (!(launcher.Connections instanceof Struct)) return;
      const connectionPatches: Record<string, any> = {};
      launcher.Connections.entries().forEach(([cIdx, conn]) => {
        if (conn.SID === struct.SID) {
          connectionPatches[cIdx] = new Struct({ SID: techSID, Name: "" });
        }
      });
      if (Object.keys(connectionPatches).length > 0) {
        launcherPatches[lIdx] = new Struct({ Connections: new Struct(connectionPatches) });
      }
    });
    if (Object.keys(launcherPatches).length > 0) {
      extraStructs.push(deepMerge(target.fork(), { Launchers: new Struct(launcherPatches) }).fork(true));
    }
  }

  return extraStructs;
}

transformQuestNodePrototypes.files = [
  "/QuestNodePrototypes/RSQ01.cfg",
  "/QuestNodePrototypes/RSQ04.cfg",
  "/QuestNodePrototypes/RSQ05.cfg",
  "/QuestNodePrototypes/RSQ06_C00___SIDOROVICH.cfg",
  "/QuestNodePrototypes/RSQ07_C00_TSEMZAVOD.cfg",
  "/QuestNodePrototypes/RSQ08_C00_ROSTOK.cfg",
  "/QuestNodePrototypes/RSQ09_C00_MALAHIT.cfg",
  "/QuestNodePrototypes/RSQ10_C00_HARPY.cfg",
];
