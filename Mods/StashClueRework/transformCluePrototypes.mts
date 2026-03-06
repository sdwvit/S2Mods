import { CluePrototype, Struct } from "s2cfgtojson";
import { getGeneratedStashSID } from "./transformSpawnActorPrototypes.mts";

let transformCluePrototypesOncePerFile = false;

// ----

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

  for (let i = 1; i <= 100; i++) {
    extraStructs.push(
      new Struct({
        __internal__: {
          rawName: getGeneratedStashSID(i),
          isRoot: true,
        },
        SID: getGeneratedStashSID(i),
        Type: "EGlobalVariableType::Bool",
        DefaultValue: false,
        ID: i,
      }) as CluePrototype,
    );
  }
  return extraStructs;
}

transformCluePrototypes.files = ["/CluePrototypes.cfg"];
