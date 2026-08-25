import { Struct } from "s2cfgtojson";
import type { TradePrototype } from "s2cfgtojson";
import type { MetaType } from "../../src/meta-type.mts";

type TG = TradePrototype["TradeGenerators"]["0"];

function entriesTransformer(struct: TradePrototype) {
  if (!struct.TradeGenerators) {
    return null;
  }
  const fork = struct.fork();
  fork.TradeGenerators = struct.TradeGenerators.map((_) => {
    const tg = new Struct() as TG;
    tg.BuyLimitations ||= new Struct() as TG["BuyLimitations"];
    tg.BuyLimitations.addNode("EItemType::Weapon");
    tg.BuyLimitations.addNode("EItemType::Armor");
    return tg;
  });
  fork.TradeGenerators.__internal__.bpatch = true;
  return fork.fork(true);
}

entriesTransformer.files = ["/TradePrototypes.cfg"];

export const meta: MetaType<TradePrototype> = {
  description: `
[h1]Deprecated in 2.0[/h1]
[h1][/h1]
With the new game on the new Unreal Engine, mod structure changes — some mods are now part of the base game. Replacements will be released as separate mods.
[hr][/hr]
   This mode does only one thing: traders don't buy Weapons / Helmets / Armor.
[hr][/hr]
No more loot goblin.
[hr][/hr]
Warning: this makes the game more difficult and interesting.[h1][/h1]
Meant to be used in other collections of mods.
   
[hr][/hr]If you enjoy my mods and would like to support me, you can donate here: [url=https://donate.stripe.com/3cIbJ21Ld7u4clXfyb5Rm03]donate[/url]. Feel free to mention which mod you're donating for — it helps me understand what you're interested in.
`,
  changenote: "Fix an issue with overriding structs",
  structTransformers: [entriesTransformer],
};
