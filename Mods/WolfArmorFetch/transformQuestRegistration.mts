import { Struct } from "s2cfgtojson";
import type { QuestPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

let once = false;

export const transformQuestRegistration: StructTransformer<QuestPrototype> = () => {
  if (once) return;
  once = true;

  return new Struct({
    __internal__: { rawName: "WolfArmorFetch", isRoot: true },
    SID: "WolfArmorFetch",
    DLC: "None",
  }) as QuestPrototype;
};
transformQuestRegistration.files = ["/QuestPrototypes/SQ86.cfg"];
