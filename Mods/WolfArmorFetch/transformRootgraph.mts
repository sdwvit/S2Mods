import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";

let once = false;

export const transformRootgraph: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  const SID = "WolfArmorFetch_Launch";

  return [
    new Struct({
      __internal__: { rawName: SID, isRoot: true },
      SID,
      QuestSID: "rootgraph",
      NodeType: "EQuestNodeType::ConsoleCommand",
      ConsoleCommand: "XStartQuestBySID WolfArmorFetch",
      Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
    }),
  ];
};
transformRootgraph.files = ["/QuestNodePrototypes/rootgraph.cfg"];
