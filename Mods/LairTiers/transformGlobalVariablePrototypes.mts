import { Struct } from "s2cfgtojson";
import type { CluePrototype, EGlobalVariableType } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { LAIR_TIER_GLOBAL_VARIABLE_SID, lairHeldOffVariableSID, lairTierVariableSID, tieredLairs } from "./lairTiers.mts";

const variables: Array<{ sid: string; description: string; defaultValue: number }> = [
  { sid: LAIR_TIER_GLOBAL_VARIABLE_SID, description: "LairTiers: lair tier the player's level calls for", defaultValue: 0 },
  ...tieredLairs.map((lair) => ({
    sid: lairTierVariableSID(lair.sid),
    description: "LairTiers: tier this lair is switched to (0 = vanilla)",
    defaultValue: 0,
  })),
  ...tieredLairs
    .filter((lair) => lair.questToggled)
    .map((lair) => ({
      sid: lairHeldOffVariableSID(lair.sid),
      description: "LairTiers: 1 while a quest holds this lair switched off",
      defaultValue: lair.startsHeldOff ? 1 : 0,
    })),
];

let once = false;

export const transformGlobalVariablePrototypes: StructTransformer<Struct> = (struct) => {
  if (once || struct.__internal__.rawName !== "[0]") return null;
  once = true;

  return variables.map(({ sid, description, defaultValue }) => {
    const variable = new Struct() as CluePrototype;
    variable.SID = sid;
    variable.Description = description;
    variable.Type = "EGlobalVariableType::Int" as EGlobalVariableType;
    variable.DefaultValue = defaultValue as any;
    variable.__internal__.rawName = sid;
    variable.__internal__.isRoot = true;
    return variable;
  });
};

transformGlobalVariablePrototypes.files = ["/GlobalVariablePrototypes.cfg"];
