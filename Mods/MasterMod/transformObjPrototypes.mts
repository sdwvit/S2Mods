import { ObjPrototype } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";

/**
 * Prevents NPCs from being knocked down.
 * Also removes Fall damage.
 * @param struct
 */
export const transformObjPrototypes: EntriesTransformer<ObjPrototype> = async (struct) => {
  if (struct.ShouldGenerateStashClues) {
    const fork = struct.fork();
    fork.ShouldGenerateStashClues = false;
    return fork;
  }
};
transformObjPrototypes.files = ["/GameData/ObjPrototypes.cfg", "/ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
