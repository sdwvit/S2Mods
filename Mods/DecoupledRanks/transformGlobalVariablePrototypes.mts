import { Struct } from "s2cfgtojson";
import type { CluePrototype, EGlobalVariableType } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

export const XP_GLOBAL_VARIABLE_SID = "DecoupledRanksXP";
export const LEVEL_GLOBAL_VARIABLE_SID = "DecoupledRanksLevel";
export const RANK_GLOBAL_VARIABLE_SID = "DecoupledRanksRankOrdinal";

const variables = [
  { sid: XP_GLOBAL_VARIABLE_SID, description: "DecoupledRanks: accumulated XP score" },
  { sid: LEVEL_GLOBAL_VARIABLE_SID, description: "DecoupledRanks: resolved player level" },
  { sid: RANK_GLOBAL_VARIABLE_SID, description: "DecoupledRanks: resolved rank ordinal" },
] as const;

let oncePerFile = false;

export const transformGlobalVariablePrototypes: StructTransformer<Struct> = (struct, context) => {
  if (oncePerFile || struct.__internal__.rawName !== "[0]") {
    return null;
  }

  oncePerFile = true;
  const existingSIDs = new Set(
    Object.values(context.structsById)
      .map((s) => (s as any).SID)
      .filter(Boolean),
  );

  return variables
    .filter(({ sid }) => !existingSIDs.has(sid))
    .map(({ sid, description }) => {
      const variable = new Struct() as CluePrototype;
      variable.SID = sid;
      variable.Description = description;
      variable.Type = "EGlobalVariableType::Int" as EGlobalVariableType;
      variable.DefaultValue = 0 as any;
      variable.__internal__.rawName = sid;
      variable.__internal__.isRoot = true;
      return variable;
    });
};

transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];
