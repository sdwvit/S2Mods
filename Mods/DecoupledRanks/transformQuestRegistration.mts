import { Struct } from "s2cfgtojson";
import type { QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";

let once = false;

/**
 * Every node this mod emits carries `QuestSID = DecoupledRanks`, but a quest whose SID is not
 * registered in QuestPrototypes can never be started, so none of its `LaunchOnQuestStart`
 * listeners ever arm. Register it, exactly as WolfArmorFetch does.
 */
export const transformQuestRegistration: StructTransformer<QuestPrototype> = () => {
  if (once) return;
  once = true;

  return new Struct({
    __internal__: { rawName: modName, isRoot: true },
    SID: modName,
    DLC: "None",
  }) as QuestPrototype;
};
transformQuestRegistration.files = ["/QuestPrototypes/rootgraph.cfg"];
