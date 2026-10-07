import type { StructTransformer } from "../../src/meta-type.mts";
import { fwArchetypes } from "./factionWarNpcs.mts";

let once = false;

/** Emits the eight FW archetypes once, into the file their parents live in. */
export const transformNPCArchetypes: StructTransformer<any> = (struct) => {
  if (once || String(struct.SID) !== "GeneralNPC_Freedom_CloseCombat") return null;
  once = true;
  return fwArchetypes();
};

transformNPCArchetypes.files = ["/ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
