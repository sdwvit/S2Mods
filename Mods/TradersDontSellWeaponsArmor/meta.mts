import type { MetaType } from "../../src/meta-type.mts";
import type { ItemGeneratorPrototype } from "s2cfgtojson";

export const meta: MetaType<ItemGeneratorPrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
    This mode does only one thing: traders no longer sell you weapons or armor.
[hr][/hr]
🪓 Welcome to the ultimate survival challenge for Stalker 2 purists!
[hr][/hr]
It is meant to be used in other collections of mods.
    
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Update for 1.7.x",
  structTransformers: [transformDynamicItemGenerator],
};

const transformTrade = (struct: ItemGeneratorPrototype) => {
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
        const PossibleItems = (e.PossibleItems as ItemGeneratorPrototype["ItemGenerator"]["0"]["PossibleItems"]).map(([_k, pi]) => {
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
  ItemGenerator.__internal__.useAsterisk = false;
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
export function transformDynamicItemGenerator(struct: ItemGeneratorPrototype) {
  /**
   * Does not allow traders to sell gear.
   */
  if (struct.SID.includes("Trade")) {
    return transformTrade(struct);
  }
}

transformDynamicItemGenerator.files = ["/DynamicItemGenerator.cfg", "QuestItemGeneratorPrototypes.cfg"];
