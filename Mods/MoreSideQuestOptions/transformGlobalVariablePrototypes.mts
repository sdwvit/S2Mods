import { Struct } from "s2cfgtojson";
import type { GlobalVariablePrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { allSubQuests, getGlobalVarSID } from "./local.consts.mts";

let once = false;

export const transformGlobalVariablePrototypes: StructTransformer<GlobalVariablePrototype> = () => {
  if (once) return;
  once = true;

  return allSubQuests.map((subQuest) => {
    const sid = getGlobalVarSID(subQuest);
    return new Struct({
      __internal__: { rawName: sid, isRoot: true },
      SID: sid,
      Type: "EGlobalVariableType::Bool",
      DefaultValue: false,
    }) as GlobalVariablePrototype;
  });
};

transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];
