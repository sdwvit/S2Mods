import { EGlobalVariableType, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { createGlobalVariablePrototype } from "../../src/global-variable-utils.mts";
import { modName } from "../../src/base-paths.mts";

export const XP_GLOBAL_VARIABLE_SID = `${modName}_XP`;
let once = false;
export const addXpGlobalVariable: StructTransformer<Struct> = () => {
  if (once) return;
  once = true;

  return createGlobalVariablePrototype(XP_GLOBAL_VARIABLE_SID, "EGlobalVariableType::Int" as EGlobalVariableType, 0, {
    description: "DecoupledRanks XP accumulator",
  });
};

addXpGlobalVariable.files = ["/GlobalVariablePrototypes.cfg"];
