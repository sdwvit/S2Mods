import { Struct } from "s2cfgtojson";
import type { GlobalVariablePrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { allSubQuests, getGlobalVarSID, getReadyForTurnInVarSID, getReturnToAddJobVarSID, vendors } from "./local.consts.mts";

let once = false;

export const transformGlobalVariablePrototypes: StructTransformer<GlobalVariablePrototype> = () => {
  if (once) return;
  once = true;

  return [
    ...vendors.map((vendor) => new Struct({
      __internal__: { rawName: getReturnToAddJobVarSID(vendor.questSID), isRoot: true },
      SID: getReturnToAddJobVarSID(vendor.questSID),
      Type: "EGlobalVariableType::Bool",
      DefaultValue: false,
    }) as GlobalVariablePrototype),
    ...allSubQuests.flatMap((subQuest) => {
    const activeSid = getGlobalVarSID(subQuest);
    const readySid = getReadyForTurnInVarSID(subQuest);
    return [
      new Struct({
        __internal__: { rawName: activeSid, isRoot: true },
        SID: activeSid,
        Type: "EGlobalVariableType::Bool",
        DefaultValue: false,
      }) as GlobalVariablePrototype,
      new Struct({
        __internal__: { rawName: readySid, isRoot: true },
        SID: readySid,
        Type: "EGlobalVariableType::Bool",
        DefaultValue: false,
      }) as GlobalVariablePrototype,
    ];
    }),
  ];
};

transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];
