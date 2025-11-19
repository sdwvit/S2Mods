import { ArmorPrototype, Struct } from "s2cfgtojson";
import { allExtraArmors, newArmors } from "./armors.util.mjs";
import { undroppableArmors } from "./undroppableArmors.mjs";
import { get } from "./get.mjs";
import { backfillArmorDef } from "./backfillArmorDef.mjs";
import { allDefaultArmorDefs } from "./allDefaultArmorDefs.mjs";
import { EntriesTransformer } from "../../src/metaType.mjs";
import { deepMerge } from "../../src/deepMerge.mjs";

/**
 * Adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.
 */
export const transformArmorPrototypes: EntriesTransformer<ArmorPrototype> = (struct, context) => {
  if (undroppableArmors.has(struct.SID)) {
    return null;
  }

  if (!oncePerFile.has(context.filePath)) {
    oncePerFile.add(context.filePath);
    allExtraArmors.forEach((descriptor) => {
      const original = descriptor.__internal__.refkey;
      const newSID = descriptor.SID;
      if (!context.structsById[original]) {
        return;
      }
      const armor = allDefaultArmorDefs[original];
      if (!armor) {
        return;
      }

      const newArmor = new Struct({
        SID: newSID,
        __internal__: { rawName: newSID, refkey: original, refurl: struct.__internal__.refurl },
      }) as ArmorPrototype;
      backfillArmorDef(newArmor);
      const overrides = { ...newArmors[newSID as keyof typeof newArmors] };
      if (overrides.__internal__?._extras && "keysForRemoval" in overrides.__internal__._extras) {
        Object.entries(overrides.__internal__._extras.keysForRemoval).forEach(
          ([p, v]: [string, string[] | number[] | string | number]) => {
            const e = get(newArmor, p) || {};
            if (Array.isArray(v)) {
              const vSet = new Set(v.map(String));
              const keysToDelete: string[] | number[] = Object.keys(e).filter((k) => vSet.has(e[k])) || v;
              keysToDelete.forEach((k) => delete e[k]);
            } else {
              const keyToDelete = Object.keys(e).find((k) => e[k] === v) || v;
              delete e[keyToDelete];
            }
          },
        );
        // delete overrides.__internal__._extras;
      }
      deepMerge(newArmor, overrides);
      if (!newArmors[newSID]) {
        newArmor.Invisible = true;
      }
      context.extraStructs.push(newArmor.clone());
    });
  }

  return null;
};
const oncePerFile = new Set<string>();

transformArmorPrototypes._name =
  "adds armor that doesn't block head, but also removes any psy protection. Allows player to use helmets.";
transformArmorPrototypes.files = ["ArmorPrototypes.cfg"];
