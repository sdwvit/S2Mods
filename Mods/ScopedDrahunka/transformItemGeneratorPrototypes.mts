import { Struct } from "s2cfgtojson";
import type { ItemGeneratorPrototype } from "s2cfgtojson";
import { DRAHUNKA_SID, SCOPE_SID } from "./consts.mts";

export const SKIF_ITEM_GENERATOR_SID = "ItemGen_Skif_ScopedDrahunka";

let once = false;

/** Generator for the Skif debug node: a Drahunka (spawns scoped) and a spare scope. */
export function transformItemGeneratorPrototypes() {
  if (once) {
    return null;
  }
  once = true;
  const ItemGenerator = new Struct({}) as ItemGeneratorPrototype["ItemGenerator"];
  ItemGenerator.addNode(
    new Struct({
      Category: "EItemGenerationCategory::WeaponPrimary",
      bAllowSameCategoryGeneration: true,
      PossibleItems: new Struct({
        [DRAHUNKA_SID]: new Struct({
          ItemPrototypeSID: DRAHUNKA_SID,
          Chance: 1,
          MinDurability: 1,
          MaxDurability: 1,
        }),
      }),
    }),
    DRAHUNKA_SID,
  );
  ItemGenerator.addNode(
    new Struct({
      Category: "EItemGenerationCategory::Attach",
      bAllowSameCategoryGeneration: true,
      PossibleItems: new Struct({
        [SCOPE_SID]: new Struct({ ItemPrototypeSID: SCOPE_SID, Chance: 1 }),
      }),
    }),
    SCOPE_SID,
  );
  return new Struct({
    __internal__: { rawName: SKIF_ITEM_GENERATOR_SID, isRoot: true },
    SID: SKIF_ITEM_GENERATOR_SID,
    ItemGenerator,
  }) as ItemGeneratorPrototype;
}

transformItemGeneratorPrototypes.files = ["/ItemGeneratorPrototypes.cfg"];
