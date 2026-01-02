import { WeaponPrototype } from "s2cfgtojson";
import { EntriesTransformer } from "../../src/meta-type.mts";
import { getTemplate } from "../../src/backfill-def.mts";
import { allDefaultWeaponPrototypesRecord } from "../../src/consts.mts";

/**
 * Remove an essential flag from various items
 * And allow smgs to go into a pistol slot
 */
export const transformWeaponPrototypes: EntriesTransformer<WeaponPrototype> = async (struct) => {
  const fork = struct.fork();

  if (struct.IsQuestItem) {
    fork.IsQuestItem = false;
  }
  if (fork.entries().length) {
    return fork;
  }
};
transformWeaponPrototypes.files = ["/WeaponPrototypes.cfg"];
