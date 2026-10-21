import { Struct } from "s2cfgtojson";
import type { QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { QC } from "./cover.mts";

let once = false;

export const transformQuestRegistration: StructTransformer<QuestPrototype> = () => {
  if (once) return;
  once = true;

  // Jobs 1-2, and job 3 (Cover Story), a quest of its own: see ./cover.mts.
  return ["WolfArmorFetch", QC].map(
    (SID) => new Struct({ __internal__: { rawName: SID, isRoot: true }, SID, DLC: "None" }) as QuestPrototype,
  );
};
transformQuestRegistration.files = ["/QuestPrototypes/rootgraph.cfg"];
