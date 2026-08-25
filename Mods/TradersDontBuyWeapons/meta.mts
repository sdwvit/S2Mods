import type { MetaType } from "../../src/meta-type.mts";
import { Struct } from "s2cfgtojson";
import type { TradePrototype } from "s2cfgtojson";

export const meta: MetaType<TradePrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
This mod makes traders refuse to purchase Weapons.
[hr][/hr]  
bPatches TradePrototypes.cfg
   
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Fix an issue with overriding structs",
  structTransformers: [entriesTransformer],
};

function entriesTransformer(struct: TradePrototype) {
  if (!struct.TradeGenerators) {
    return null;
  }
  const fork = struct.fork();
  fork.TradeGenerators = struct.TradeGenerators.map(([k, e]) => {
    const fork = e.fork();
    fork.BuyLimitations = new Struct() as any;
    fork.BuyLimitations.addNode("EItemType::Weapon");
    return fork;
  });

  return fork.fork(true);
}

entriesTransformer.files = ["/TradePrototypes.cfg"];
