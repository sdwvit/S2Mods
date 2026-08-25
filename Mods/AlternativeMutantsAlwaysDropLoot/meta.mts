import { Struct } from "s2cfgtojson";
import type { ItemGeneratorPrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

export const meta: MetaType = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
Mutants always drop 1 loot item.
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Initial release",
  structTransformers: [structTransformer],
};

const mutantLootSet = new Set([
  "BlinddogLootGenerator",
  "BloodsuckerLootGenerator",
  "BoarLootGenerator",
  "BurerLootGenerator",
  "CatLootGenerator",
  "ChimeraLootGenerator",
  "ControllerLootGenerator",
  "FleshLootGenerator",
  "PoltergeistLootGenerator",
  "PseudodogLootGenerator",
  "PseudogiantLootGenerator",
  "TushkanLootGenerator",
  "SnorkLootGenerator",
]);

function structTransformer(struct: ItemGeneratorPrototype) {
  if (mutantLootSet.has(struct.SID) && struct.ItemGenerator[0].PossibleItems[0].Chance !== 1) {
    const fork = struct.fork();

    fork.ItemGenerator = struct.ItemGenerator.fork();
    fork.ItemGenerator[0] = struct.ItemGenerator[0].fork();
    fork.ItemGenerator[0].PossibleItems = struct.ItemGenerator[0].PossibleItems.fork();
    fork.ItemGenerator[0].PossibleItems[0] = struct.ItemGenerator[0].PossibleItems[0].fork();
    fork.ItemGenerator[0].PossibleItems[0].Chance = 1;

    return fork;
  }
}

structTransformer.files = ["/ItemGeneratorPrototypes.cfg"];
