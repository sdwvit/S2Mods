import { DynamicItemGenerator } from "s2cfgtojson";
import { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType<DynamicItemGenerator> = {
  description: `
    This mode does only one thing: traders no longer sell you weapons or armor.
[hr][/hr]
🪓 Welcome to the ultimate survival challenge for Stalker 2 purists!
[hr][/hr]
It is meant to be used in other collections of mods.
    `,
  changenote: "Update for 1.7.x",
  structTransformers: [transformDynamicItemGenerator],
};

const transformTrade = (struct: DynamicItemGenerator) => {
  const fork = struct.fork();
  if (!struct.RefreshTime) {
    fork.RefreshTime = "1d";
  }
  const ItemGenerator = struct.ItemGenerator.map(([_k, e]) => {
    // noinspection FallThroughInSwitchStatementJS
    switch (e.Category) {
      case "EItemGenerationCategory::BodyArmor":
      case "EItemGenerationCategory::Head":
      case "EItemGenerationCategory::WeaponPrimary":
      case "EItemGenerationCategory::WeaponPistol":
      case "EItemGenerationCategory::WeaponSecondary":
        return Object.assign(e.fork(), { ReputationThreshold: 1000000 });
      case "EItemGenerationCategory::SubItemGenerator": {
        const PossibleItems = (e.PossibleItems as DynamicItemGenerator["ItemGenerator"]["0"]["PossibleItems"]).map(([_k, pi]) => {
          if (pi.ItemGeneratorPrototypeSID?.includes("Gun")) {
            return Object.assign(pi.fork(), { Chance: 0 }); // Disable gun sell
          }
        });
        if (!PossibleItems.entries().length) {
          return;
        }
        PossibleItems.__internal__.bpatch = true;
        return Object.assign(e.fork(), { PossibleItems });
      }
    }
  });
  if (!ItemGenerator.entries().length) {
    return;
  }
  ItemGenerator.__internal__.bpatch = true;
  return Object.assign(fork, { ItemGenerator });
};

/**
 * Does not allow traders to sell gear.
 * Allows NPCs to drop armor.
 */
export function transformDynamicItemGenerator(struct: DynamicItemGenerator) {
  /**
   * Does not allow traders to sell gear.
   */
  if (struct.SID.includes("Trade")) {
    return transformTrade(struct);
  }
}

transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
