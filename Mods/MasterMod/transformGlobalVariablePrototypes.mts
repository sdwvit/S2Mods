import { CluePrototype, EGlobalVariableType, Struct } from "s2cfgtojson";
import { StructTransformer } from "../../src/meta-type.mts";
import { QuestDataTableByQuestSID } from "./rewardFormula.mts";

let oncePerFile = false;

const getLatestQuestVariantVariableSID = (vendor: string) => `${vendor.replace(/\W/g, "")}_latest_quest_variant`;

function getMissingVariantTrackingVariables(context: Parameters<StructTransformer<Struct>>[1]) {
  const existingSIDs = new Set(
    Object.values(context.structsById)
      .map((s) => (s as any).SID)
      .filter(Boolean),
  );

  const requiredSIDs = new Set<string>();
  for (const variants of Object.values(QuestDataTableByQuestSID)) {
    if (variants.length <= 1) {
      continue;
    }
    requiredSIDs.add(getLatestQuestVariantVariableSID(variants[0].Vendor));
  }

  return [...requiredSIDs].filter((sid) => !existingSIDs.has(sid)).sort();
}

export const transformGlobalVariablePrototypes: StructTransformer<Struct> = async (struct, context) => {
  if (oncePerFile || struct.__internal__.rawName !== "[0]") {
    return null;
  }

  oncePerFile = true;
  const missingSIDs = getMissingVariantTrackingVariables(context);
  if (!missingSIDs.length) {
    return null;
  }

  return missingSIDs.map((sid) => {
    const variable = new Struct() as CluePrototype;
    variable.SID = sid;
    variable.Description = "MasterMod: latest recurring quest variant";
    variable.Type = "EGlobalVariableType::Int" as EGlobalVariableType;
    variable.DefaultValue = 0 as any;
    variable.__internal__.rawName = sid;
    variable.__internal__.isRoot = true;
    return variable;
  });
};

transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];
