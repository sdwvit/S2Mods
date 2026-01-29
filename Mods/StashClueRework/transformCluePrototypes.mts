import { CluePrototype, Struct } from "s2cfgtojson";
import { QuestDataTable } from "../MasterMod/rewardFormula.mts";
import { getGeneratedStashSID } from "./transformSpawnActorPrototypes.mts";

let transformCluePrototypesOncePerFile = false;
/**
 * Injects 100 generated stash clue prototypes into CluePrototypes.cfg
 * Each generated struct uses `SID` = `Gen_Stash{n}` and minimal internal metadata.
 * Returns `null` to indicate no modification to the original entries.
 */
export function transformCluePrototypes() {
  if (transformCluePrototypesOncePerFile) {
    return null;
  }

  transformCluePrototypesOncePerFile = true;
  const extraStructs: CluePrototype[] = [];
  [...new Set(QuestDataTable.map((q) => `${q.Vendor.replace(/\W/g, "")}_latest_quest_variant`))].forEach((SID) => {
    extraStructs.push(
      new Struct(`
          ${SID} : struct.begin {refkey=[0]}
             SID = ${SID}
             Type = EGlobalVariableType::Int
             DefaultValue = 0
          struct.end
      `) as CluePrototype,
    );
  });
  for (let i = 1; i <= 100; i++) {
    extraStructs.push(
      new Struct({
        __internal__: {
          refkey: "[0]",
          rawName: getGeneratedStashSID(i),
          isRoot: true,
        },
        SID: getGeneratedStashSID(i),
      }) as CluePrototype,
    );
  }
  return extraStructs;
}

transformCluePrototypes.files = ["/CluePrototypes.cfg"];
