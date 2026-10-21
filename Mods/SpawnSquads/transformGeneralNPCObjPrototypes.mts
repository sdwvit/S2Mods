import { Struct } from "s2cfgtojson";
import type { StructTransformer } from "../../src/meta-type.mts";
import { FRIENDLY_FACTION, FRIENDLY_PROTOTYPES, friendlyPrototypeSID } from "./squads.mts";

let once = false;

/** A copy of each faction soldier the friendly squads use, moved to a faction that is Friend to the player. */
export const transformGeneralNPCObjPrototypes: StructTransformer<Struct> = () => {
  if (once) return null;
  once = true;
  return FRIENDLY_PROTOTYPES.map(({ faction, role }) => {
    const sid = friendlyPrototypeSID(faction, role);
    const s = new Struct({ SID: sid, Faction: FRIENDLY_FACTION }) as Struct;
    s.__internal__.rawName = sid;
    s.__internal__.isRoot = true;
    s.__internal__.refkey = `GeneralNPC_${faction}_${role}`;
    return s;
  });
};

transformGeneralNPCObjPrototypes.files = ["/ObjPrototypes/GeneralNPCObjPrototypes.cfg"];
