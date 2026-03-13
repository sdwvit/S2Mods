import { Struct } from "s2cfgtojson";
import type { ObjPrototype, QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { modName } from "../../src/base-paths.mts";

let once = false;

export const transformQuestPrototypes: StructTransformer<QuestPrototype> = async (struct) => {
  if (once) return;

  return new Struct({
    __internal__: {
      rawName: modName,
      isRoot: true,
    },
    SID: modName,
    DLC: 'None'
  }) as QuestPrototype;
};
transformQuestPrototypes.files = ["/QuestPrototypes/A-life_interrupts.cfg"];
