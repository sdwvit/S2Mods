import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { getLaunchers } from "../../src/struct-utils.mts";
import { QC } from "./cover.mts";

let once = false;

export const transformRootgraph: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  // Same shape as DecoupledRanks' launcher, so the quest also starts on saves made before install: the SID
  // carries the owning quest's prefix (`rootgraph_`), and the quest is registered in rootgraph.cfg.
  // Job 3 (Cover Story) is a quest of its own, started the same way.
  return ["WolfArmorFetch", QC].map((quest) => {
    const SID = `rootgraph_run_${quest}`;
    return new Struct({
      __internal__: { rawName: SID, isRoot: true },
      SID,
      QuestSID: "rootgraph",
      NodeType: "EQuestNodeType::ConsoleCommand",
      ConsoleCommand: `XStartQuestBySID ${quest}`,
      Launchers: getLaunchers([{ SID: "rootgraph_Start" }]),
    });
  });
};
transformRootgraph.files = ["/QuestNodePrototypes/rootgraph.cfg"];
