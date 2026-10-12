import { Struct } from "s2cfgtojson";
import type { CluePrototype, EGlobalVariableType } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

/**
 * Always true while the mod is installed, so other mods and quest logic can detect HeadlessArmors.
 */
export const INSTALLED_GLOBAL_VARIABLE_SID = "HeadlessArmorsInstalled";

let oncePerFile = false;

export const transformGlobalVariablePrototypes: StructTransformer<Struct> = (struct) => {
  if (oncePerFile || struct.__internal__.rawName !== "[0]") {
    return null;
  }

  oncePerFile = true;
  const variable = new Struct() as CluePrototype;
  variable.SID = INSTALLED_GLOBAL_VARIABLE_SID;
  variable.Description = "HeadlessArmors: mod is installed";
  variable.Type = "EGlobalVariableType::Bool" as EGlobalVariableType;
  variable.DefaultValue = true as any;
  variable.__internal__.rawName = INSTALLED_GLOBAL_VARIABLE_SID;
  variable.__internal__.isRoot = true;
  return [variable];
};

transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];
