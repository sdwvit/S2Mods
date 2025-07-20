import { GetStructType, Struct } from "s2cfgtojson";

/**
 * Prevents NPCs from being knocked down.
 * Also removes Fall damage.
 * @param entries
 * @param file
 */
export function transformObjPrototypes(entries: ObjPrototypes["entries"], { file }: { file: string }) {
  if (!file.includes("GameData/ObjPrototypes.cfg") && !file.includes("ObjPrototypes/GeneralNPCObjPrototypes.cfg")) {
    return entries;
  }
  if (entries.SID === "NPCBase" || entries.SID === "Player") {
    class Protection extends Struct<{ Fall: number }> {
      _id: string = "Protection";
      entries = { Fall: 100 };
    }

    return { CanBeKnockedDown: false, Protection: new Protection() };
  }
  return null;
}
export type ObjPrototypes = GetStructType<{
  CanBeKnockedDown: boolean;
  SID: string;
  Protection: { Fall: number };
}>;
