import type { ObjPrototype } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";

export const transformObjPrototypes: StructTransformer<ObjPrototype> = async (struct) => {
  const fork = struct.fork();
  fork.ShouldGenerateStashClues = false;
  return fork;
};
transformObjPrototypes.files = ["/GameData/ObjPrototypes.cfg", "/ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
