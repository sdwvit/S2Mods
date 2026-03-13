import { Struct } from "s2cfgtojson";
import type { EGlobalVariableType } from "s2cfgtojson";
import type { GlobalVariablePrototype } from "s2cfgtojson";

export type GlobalVariableValue = boolean | number | string;

export function createGlobalVariablePrototype(
  sid: string,
  type: EGlobalVariableType,
  defaultValue: GlobalVariableValue,
  options?: {
    description?: string;
    id?: number;
  },
) {
  const variable = new Struct() as GlobalVariablePrototype;
  variable.SID = sid;
  variable.Description = options?.description ?? "";
  variable.Type = type;
  variable.DefaultValue = defaultValue as any;

  variable.__internal__.rawName = sid;
  variable.__internal__.isRoot = true;
  return variable;
}
