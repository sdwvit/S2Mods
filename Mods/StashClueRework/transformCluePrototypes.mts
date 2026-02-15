import { CluePrototype, Struct } from "s2cfgtojson";
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

  for (let i = 1; i <= 100; i++) {
    const clue = new Struct({
      __internal__: {
        refkey: "[0]",
        rawName: getGeneratedStashSID(i),
        isRoot: true,
      },
      ID: i + 57, // 57 is currently last id
      SID: getGeneratedStashSID(i),
    }) as CluePrototype;
    extraStructs.push(clue);
  }
  return extraStructs;
}

transformCluePrototypes.files = ["/CluePrototypes.cfg"];
